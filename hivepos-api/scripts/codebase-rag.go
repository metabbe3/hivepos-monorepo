package main

// hivePOS Go codebase-RAG — structural index + BM25 retrieval.
// Same algorithm as the TypeScript codebase-rag.ts but uses Go's AST parser
// (go/parser + go/ast) instead of TypeScript compiler API.
//
// Usage:
//   go run scripts/codebase-rag.go index
//   go run scripts/codebase-rag.go query "<term>" [-n 10]
//   go run scripts/codebase-rag.go symbol <name>
//   go run scripts/codebase-rag.go callers <name>
//   go run scripts/codebase-rag.go callees <name>
//   go run scripts/codebase-rag.go stats
//
// One chunk = one symbol (function, method, struct, interface, type, const).
// Zero LLM at index time. In-memory BM25 + lexical re-rank.

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode"
)

const (
	StoreDir   = ".codebase-rag"
	IndexPath  = ".codebase-rag/index.json"
	RecallN    = 25
	K1         = 1.2
	B          = 0.75
	IndexFmt   = 2
)

var SrcDirs = []string{"cmd", "internal"}
var SkipDirs = map[string]bool{
	".git": true, "vendor": true, "tmp": true, "node_modules": true,
	".codebase-rag": true, "deployments": true, "docs": true,
	"migrations": true, "scripts": true,
}

type Symbol struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Kind       string   `json:"kind"`
	FilePath   string   `json:"file_path"`
	StartLine  int      `json:"startLine"`
	EndLine    int      `json:"endLine"`
	Signature  string   `json:"signature"`
	Receiver   string   `json:"receiver,omitempty"`
	Summary    string   `json:"summary"`
	CalledBy   []string `json:"called_by"`
	Calls      []string `json:"calls"`
	FileHash   string   `json:"file_hash"`
	Code       string   `json:"code"`
}

type Index struct {
	Format  int                 `json:"format"`
	Files   map[string]FileMeta `json:"files"`
	Symbols map[string]Symbol   `json:"symbols"`
}

type FileMeta struct {
	Mtime int64  `json:"mtime"`
	Hash  string `json:"hash"`
}

var stopNames = map[string]bool{
	"new": true, "get": true, "set": true, "err": true, "ctx": true,
	"nil": true, "true": true, "false": true, "return": true, "if": true,
	"for": true, "range": true, "make": true, "append": true, "len": true,
	"func": true, "type": true, "struct": true, "interface": true,
	"string": true, "int": true, "bool": true, "error": true,
	"fmt": true, "log": true, "test": true, "main": true, "run": true,
}

var synonyms = map[string][]string{
	"auth":      {"login", "session", "token", "password", "credentials", "jwt", "oauth"},
	"order":     {"cart", "checkout", "laundry", "kiloan", "garment"},
	"customer":  {"pelanggan", "contact", "deposit", "wallet"},
	"payment":   {"checkout", "stripe", "midtrans", "qris", "invoice", "transaction"},
	"attendance": {"clock", "absen", "pin", "timesheet", "shift"},
	"report":    {"stats", "summary", "export", "revenue", "profit"},
	"error":     {"fail", "crash", "bug", "panic", "recover"},
	"config":    {"setting", "env", "option", "flag"},
	"middleware": {"interceptor", "chain", "filter"},
	"database":  {"postgres", "pgx", "sql", "query", "repository"},
	"router":    {"route", "handler", "endpoint", "chi"},
	"permission": {"rbac", "role", "access", "forbidden"},
}

// ── Hashing ──

func sha256hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// ── Walk ──

func walk(dir string, files *[]string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		full := filepath.Join(dir, e.Name())
		if e.IsDir() {
			if SkipDirs[e.Name()] {
				continue
			}
			walk(full, files)
		} else if strings.HasSuffix(e.Name(), ".go") && !strings.HasSuffix(e.Name(), "_test.go") {
			*files = append(*files, full)
		}
	}
}

// ── AST Extraction ──

func extractSymbols(relPath, content string) []Symbol {
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, relPath, content, parser.ParseComments)
	if err != nil {
		return nil
	}

	var out []Symbol
	fullText := content

	docComment := func(d *ast.CommentGroup) string {
		if d == nil {
			return ""
		}
		return strings.TrimSpace(d.Text())
	}

	// Functions
	for _, decl := range f.Decls {
		switch d := decl.(type) {
		case *ast.FuncDecl:
			name := d.Name.Name
			receiver := ""
			kind := "function"
			if d.Recv != nil {
				kind = "method"
				if len(d.Recv.List) > 0 {
					if star, ok := d.Recv.List[0].Type.(*ast.StarExpr); ok {
						if ident, ok := star.X.(*ast.Ident); ok {
							receiver = ident.Name
						}
					} else if ident, ok := d.Recv.List[0].Type.(*ast.Ident); ok {
						receiver = ident.Name
					}
				}
				name = receiver + "." + name
			}

			startLine := fset.Position(d.Pos()).Line
			endLine := fset.Position(d.End()).Line
			summary := docComment(d.Doc)
			if summary == "" {
				summary = kind + " " + name
			}
			summary = strings.ReplaceAll(summary, "\n", " ")

			// Extract signature from source
			lineEnd := fset.Position(d.Body.Pos()).Line
			if lineEnd > endLine {
				lineEnd = endLine
			}
			lines := strings.Split(fullText, "\n")
			sigLine := ""
			if lineEnd <= len(lines) {
				sigLine = strings.Join(lines[:lineEnd], "\n")
				if idx := strings.Index(sigLine, "{"); idx >= 0 {
					sigLine = sigLine[:idx]
				}
			}

			out = append(out, Symbol{
				ID:        fmt.Sprintf("%s:%s:%d", relPath, name, startLine),
				Name:      name,
				Kind:      kind,
				FilePath:  relPath,
				StartLine: startLine,
				EndLine:   endLine,
				Signature: sigLine,
				Receiver:  receiver,
				Summary:   summary,
				CalledBy:  []string{},
				Calls:     []string{},
			})

		case *ast.GenDecl:
			for _, spec := range d.Specs {
				switch s := spec.(type) {
				case *ast.TypeSpec:
					kind := "type"
					if _, ok := s.Type.(*ast.StructType); ok {
						kind = "struct"
					} else if _, ok := s.Type.(*ast.InterfaceType); ok {
						kind = "interface"
					}
					startLine := fset.Position(s.Pos()).Line
					endLine := fset.Position(s.End()).Line
					summary := docComment(d.Doc)
					if summary == "" {
						summary = kind + " " + s.Name.Name
					}
					out = append(out, Symbol{
						ID:        fmt.Sprintf("%s:%s:%d", relPath, s.Name.Name, startLine),
						Name:      s.Name.Name,
						Kind:      kind,
						FilePath:  relPath,
						StartLine: startLine,
						EndLine:   endLine,
						Signature: s.Name.Name,
						Summary:   strings.ReplaceAll(summary, "\n", " "),
						CalledBy:  []string{},
						Calls:     []string{},
					})
				case *ast.ValueSpec:
					for _, name := range s.Names {
						kind := "const"
						if d.Tok == token.VAR {
							kind = "var"
						}
						startLine := fset.Position(name.Pos()).Line
						summary := name.Name
						out = append(out, Symbol{
							ID:        fmt.Sprintf("%s:%s:%d", relPath, name.Name, startLine),
							Name:      name.Name,
							Kind:      kind,
							FilePath:  relPath,
							StartLine: startLine,
							EndLine:   startLine,
							Signature: name.Name,
							Summary:   summary,
							CalledBy:  []string{},
							Calls:     []string{},
						})
					}
				}
			}
		}
	}

	return out
}

// ── Call Graph ──

func recomputeCalls(syms []Symbol) {
	nameToIDs := make(map[string][]string)
	for _, s := range syms {
		names := []string{s.Name}
		if s.Receiver != "" {
			parts := strings.SplitN(s.Name, ".", 2)
			if len(parts) == 2 {
				names = append(names, parts[1])
			}
		}
		for _, n := range names {
			if len(n) < 3 || stopNames[strings.ToLower(n)] {
				continue
			}
			nameToIDs[n] = append(nameToIDs[n], s.ID)
		}
	}
	byID := make(map[string]*Symbol)
	for i := range syms {
		syms[i].CalledBy = []string{}
		syms[i].Calls = []string{}
		byID[syms[i].ID] = &syms[i]
	}
	for i := range syms {
		s := &syms[i]
		tokens := tokenize(s.Code)
		seen := make(map[string]bool)
		for _, tok := range tokens {
			if targets, ok := nameToIDs[tok]; ok {
				for _, tid := range targets {
					if tid != s.ID && !seen[tid] {
						seen[tid] = true
						byID[tid].CalledBy = append(byID[tid].CalledBy, s.ID)
						s.Calls = append(s.Calls, tid)
					}
				}
			}
		}
	}
	for i := range syms {
		syms[i].CalledBy = dedupe(syms[i].CalledBy)
		syms[i].Calls = dedupe(syms[i].Calls)
	}
}

func dedupe(s []string) []string {
	seen := make(map[string]bool)
	var out []string
	for _, v := range s {
		if !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	if len(out) > 50 {
		return out[:50]
	}
	return out
}

// ── Tokenize (same algorithm as TS RAG) ──

func tokenize(raw string) []string {
	// Split on camelCase + non-alphanumeric
	var b strings.Builder
	for _, r := range raw {
		if unicode.IsUpper(r) && b.Len() > 0 {
			b.WriteByte(' ')
		}
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(unicode.ToLower(r))
		} else {
			b.WriteRune(' ')
		}
	}
	parts := strings.Fields(b.String())
	var out []string
	for _, p := range parts {
		if len(p) >= 2 && !stopNames[p] {
			out = append(out, p)
		}
	}
	return out
}

// ── BM25 ──

func bm25Doc(s Symbol) map[string]int {
	d := make(map[string]int)
	add := func(raw string, wt int) {
		for _, t := range tokenize(raw) {
			d[t] += wt
		}
	}
	add(s.Name, 5)
	add(s.Summary, 2)
	if len(s.Signature) > 0 {
		add(s.Signature[:min(240, len(s.Signature))], 1)
	}
	add(s.Kind, 1)
	add(s.Receiver, 1)
	add(s.FilePath, 1)
	return d
}

func rerank(qLower string, s Symbol) float64 {
	name := strings.ToLower(s.Name)
	qTokens := tokenize(qLower)
	score := 0.0
	if name == qLower {
		score += 100
	}
	if len(qLower) >= 3 && strings.Contains(name, qLower) {
		score += 40
	}
	if len(name) >= 3 && strings.Contains(qLower, name) {
		score += 25
	}
	if strings.HasPrefix(name, qLower) {
		score += 20
	}
	docTokens := make(map[string]bool)
	for _, t := range tokenize(s.Name) {
		docTokens[t] = true
	}
	for _, t := range tokenize(s.Summary) {
		docTokens[t] = true
	}
	if len(qTokens) > 0 && len(docTokens) > 0 {
		overlap := 0
		for _, t := range qTokens {
			if docTokens[t] {
				overlap++
			}
		}
		score += 30 * float64(overlap) / math.Max(float64(len(qTokens)), float64(len(docTokens)))
	}
	if len(qLower) >= 3 && strings.Contains(strings.ToLower(s.Summary), qLower) {
		score += 15
	}
	return score
}

func sliceCode(s Symbol) string {
	lines := strings.Split(s.Code, "\n")
	if len(lines) <= 8 {
		return s.Code
	}
	return strings.Join(lines[:4], "\n") + fmt.Sprintf("\n  // [...] %d lines collapsed\n}", len(lines)-4)
}

// ── Index Build ──

func buildIndex() {
	os.MkdirAll(StoreDir, 0755)
	existing := loadIndex()
	var files []string
	for _, d := range SrcDirs {
		walk(d, &files)
	}

	symbols := make(map[string]Symbol)
	fileCache := make(map[string]FileMeta)
	changed := 0

	for _, file := range files {
		rel, _ := filepath.Rel(".", file)
		rel = strings.ReplaceAll(rel, string(filepath.Separator), "/")
		content, err := os.ReadFile(file)
		if err != nil {
			continue
		}
		hash := sha256hex(string(content))
		info, _ := os.Stat(file)
		fileCache[rel] = FileMeta{Mtime: info.ModTime().Unix(), Hash: hash}

		if prev, ok := existing.Files[rel]; ok && prev.Hash == hash {
			for _, s := range existing.Symbols {
				if s.FilePath == rel {
					symbols[s.ID] = s
				}
			}
			continue
		}
		changed++
		for _, s := range extractSymbols(rel, string(content)) {
			s.FileHash = hash
			symbols[s.ID] = s
		}
	}

	all := make([]Symbol, 0, len(symbols))
	for _, s := range symbols {
		all = append(all, s)
	}
	recomputeCalls(all)
	for _, s := range all {
		symbols[s.ID] = s
	}

	idx := Index{Format: IndexFmt, Files: fileCache, Symbols: symbols}
	data, _ := json.MarshalIndent(idx, "", "  ")
	os.WriteFile(IndexPath, data, 0644)

	byKind := make(map[string]int)
	for _, s := range all {
		byKind[s.Kind]++
	}
	fmt.Printf("✓ Indexed %d files → %d symbols (%d changed).\n", len(files), len(all), changed)
	for _, kv := range sortedMap(byKind) {
		fmt.Printf("  %s=%d", kv.K, kv.V)
	}
	fmt.Println()
}

type kv struct{ K string; V int }
func sortedMap(m map[string]int) []kv {
	var out []kv
	for k, v := range m {
		out = append(out, kv{k, v})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].V > out[j].V })
	return out
}

// ── Load / Query ──

func loadIndex() Index {
	data, err := os.ReadFile(IndexPath)
	if err != nil {
		return Index{Files: make(map[string]FileMeta), Symbols: make(map[string]Symbol)}
	}
	var idx Index
	json.Unmarshal(data, &idx)
	if idx.Symbols == nil {
		idx.Symbols = make(map[string]Symbol)
	}
	if idx.Files == nil {
		idx.Files = make(map[string]FileMeta)
	}
	return idx
}

func loadSymbols() []Symbol {
	idx := loadIndex()
	out := make([]Symbol, 0, len(idx.Symbols))
	for _, s := range idx.Symbols {
		out = append(out, s)
	}
	return out
}

func query(term string, k int, summarize bool) {
	qLower := strings.ToLower(strings.TrimSpace(term))
	qTokens := tokenize(qLower)

	// Synonym expansion
	type weighted struct {
		token  string
		weight float64
	}
	expanded := make([]weighted, 0, len(qTokens)*3)
	for _, t := range qTokens {
		expanded = append(expanded, weighted{t, 1.0})
		if syns, ok := synonyms[t]; ok {
			for _, s := range syns {
				expanded = append(expanded, weighted{s, 0.5})
			}
		}
	}

	symbols := loadSymbols()
	N := len(symbols)

	docs := make(map[string]map[string]int)
	df := make(map[string]int)
	totalLen := 0
	for _, s := range symbols {
		d := bm25Doc(s)
		docs[s.ID] = d
		for t, c := range d {
			totalLen += c
			df[t]++
		}
	}
	avgdl := 1.0
	if N > 0 {
		avgdl = float64(totalLen) / float64(N)
	}

	type scored struct {
		s  Symbol
		bm float64
	}
	var staged []scored
	for _, s := range symbols {
		d := docs[s.ID]
		dl := 0
		for _, c := range d {
			dl += c
		}
		if dl == 0 {
			dl = 1
		}
		bm := 0.0
		for _, e := range expanded {
			tf, ok := d[e.token]
			if !ok {
				continue
			}
			dft := df[e.token]
			idf := math.Log((float64(N-dft)+0.5)/(float64(dft)+0.5) + 1)
			tfF := float64(tf)
			dlF := float64(dl)
			bm += e.weight * idf * tfF * (K1 + 1) / (tfF + K1*(1-B+B*dlF/avgdl))
		}
		if bm == 0 && len(qLower) >= 2 {
			if strings.Contains(strings.ToLower(s.Name), qLower) || strings.Contains(strings.ToLower(s.Summary), qLower) {
				bm = 0.01
			}
		}
		if bm > 0 {
			staged = append(staged, scored{s, bm})
		}
	}
	sort.Slice(staged, func(i, j int) bool { return staged[i].bm > staged[j].bm })
	if len(staged) > RecallN {
		staged = staged[:RecallN]
	}

	type ranked struct {
		s  Symbol
		rr float64
		bm float64
	}
	var final []ranked
	for _, sc := range staged {
		final = append(final, ranked{sc.s, rerank(qLower, sc.s), sc.bm})
	}
	sort.Slice(final, func(i, j int) bool {
		if final[i].rr != final[j].rr {
			return final[i].rr > final[j].rr
		}
		return final[i].bm > final[j].bm
	})
	if len(final) > k {
		final = final[:k]
	}

	label := term
	if summarize {
		label += " (summarized)"
	}
	fmt.Printf("\nTop %d for \"%s\":\n\n", len(final), label)
	byID := make(map[string]Symbol)
	for _, s := range symbols {
		byID[s.ID] = s
	}
	for _, r := range final {
		s := r.s
		fmt.Printf("▸ %s %s  —  %s:%d-%d\n", s.Kind, s.Name, s.FilePath, s.StartLine, s.EndLine)
		if s.Signature != "" {
			fmt.Printf("  sig: %s\n", strings.TrimSpace(s.Signature))
		}
		if summarize {
			fmt.Printf("  %s\n", sliceCode(s)[:min(200, len(sliceCode(s)))])
		} else {
			fmt.Printf("  %s\n", s.Summary[:min(160, len(s.Summary))])
		}
		if len(s.CalledBy) > 0 {
			c := []string{}
			for _, id := range s.CalledBy[:min(3, len(s.CalledBy))] {
				if r, ok := byID[id]; ok {
					c = append(c, fmt.Sprintf("%s %s %s:%d", r.Kind, r.Name, r.FilePath, r.StartLine))
				}
			}
			fmt.Printf("  ← callers:  %s\n", strings.Join(c, "  ,  "))
		}
		if len(s.Calls) > 0 {
			c := []string{}
			for _, id := range s.Calls[:min(3, len(s.Calls))] {
				if r, ok := byID[id]; ok {
					c = append(c, fmt.Sprintf("%s %s %s:%d", r.Kind, r.Name, r.FilePath, r.StartLine))
				}
			}
			fmt.Printf("  → callees:  %s\n", strings.Join(c, "  ,  "))
		}
		fmt.Println()
	}
}

func printStats() {
	idx := loadIndex()
	all := loadSymbols()
	byKind := make(map[string]int)
	for _, s := range all {
		byKind[s.Kind]++
	}
	fmt.Printf("files indexed: %d\n", len(idx.Files))
	fmt.Printf("symbols: %d\n", len(all))
	for _, kv := range sortedMap(byKind) {
		fmt.Printf("  %s=%d", kv.K, kv.V)
	}
	fmt.Println()
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ── CLI ──

func main() {
	if len(os.Args) < 2 {
		fmt.Println(`codebase-rag (Go) — structural code index
usage:
  go run scripts/codebase-rag.go index
  go run scripts/codebase-rag.go query "<term>" [-n 10] [--summarize]
  go run scripts/codebase-rag.go stats`)
		return
	}

	cmd := os.Args[1]
	switch cmd {
	case "index":
		buildIndex()
	case "query":
		if len(os.Args) < 3 {
			fmt.Println("usage: query <term>")
			return
		}
		k := 10
		summarize := false
		term := ""
		args := os.Args[2:]
		for i := 0; i < len(args); i++ {
			if args[i] == "-n" && i+1 < len(args) {
				fmt.Sscanf(args[i+1], "%d", &k)
				i++
			} else if args[i] == "--summarize" {
				summarize = true
			} else {
				if term != "" {
					term += " "
				}
				term += args[i]
			}
		}
		query(term, k, summarize)
	case "stats":
		printStats()
	default:
		fmt.Println("unknown command:", cmd)
	}
}

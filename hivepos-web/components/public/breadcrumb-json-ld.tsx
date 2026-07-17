interface Crumb {
  name: string;
  url: string;
}

interface BreadcrumbJsonLdProps {
  items: Crumb[];
}

/**
 * BreadcrumbList JSON-LD — cheap SEO win for service pages.
 * Home → Layanan → [Current]. Content is fully static (no user input),
 * so dangerouslySetInnerHTML is safe here.
 */
export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

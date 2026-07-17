interface JsonLdProps {
  branch: {
    name: string;
    address: string | null;
    phone: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  services: { name: string; basePrice: number }[];
  faqs?: { question: string; answer: string }[];
}

export function JsonLd({ branch, services, faqs }: JsonLdProps) {
  const localBusinessData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://hivepos.id/#laundry",
    name: branch.name || "hivePOS",
    description:
      "Laundry Kemayoran, Jakarta Pusat. Layanan antar jemput cuci kiloan, cuci sepatu, bedcover, setrika. Melayani Senen, Tanah Tinggi, Gunung Sahari & sekitarnya.",
    url: "https://hivepos.id",
    telephone: branch.phone,
    address: branch.address
      ? {
          "@type": "PostalAddress",
          streetAddress: branch.address,
          addressLocality: "Jakarta Pusat",
          addressRegion: "DKI Jakarta",
          postalCode: "10620",
          addressCountry: "ID",
        }
      : {
          "@type": "PostalAddress",
          addressLocality: "Jakarta Pusat",
          addressRegion: "DKI Jakarta",
          addressCountry: "ID",
        },
    geo:
      branch.latitude && branch.longitude
        ? {
            "@type": "GeoCoordinates",
            latitude: branch.latitude,
            longitude: branch.longitude,
          }
        : undefined,
    areaServed: [
      { "@type": "City", name: "Kemayoran" },
      { "@type": "City", name: "Senen" },
      { "@type": "City", name: "Tanah Tinggi" },
      { "@type": "City", name: "Gunung Sahari" },
      { "@type": "City", name: "Galur" },
      { "@type": "City", name: "Kramat" },
      { "@type": "City", name: "Cempaka Baru" },
      { "@type": "City", name: "Johar Baru" },
      { "@type": "City", name: "Sawah Besar" },
      { "@type": "AdministrativeArea", name: "Jakarta Pusat" },
    ],
    priceRange: "$$",
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Layanan Laundry",
      itemListElement: services.slice(0, 20).map((s, i) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: s.name,
        },
        price: s.basePrice,
        priceCurrency: "IDR",
        position: i + 1,
      })),
    },
  };

  const faqData = faqs
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessData) }}
      />
      {faqData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
        />
      )}
    </>
  );
}

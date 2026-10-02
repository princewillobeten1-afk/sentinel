import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sentinel-mu-jade.vercel.app';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/settings/', '/auth/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

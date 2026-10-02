import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sentinel-mu-jade.vercel.app';
  const now = new Date();

  const routes = [
    '',
    '/discover',
    '/terminal',
    '/trade',
    '/intelligence',
    '/launchpad',
    '/portfolio',
    '/docs',
    '/help',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === '' || route === '/discover' || route === '/terminal' ? 'always' : 'daily',
    priority: route === '' ? 1.0 : route === '/discover' || route === '/trade' || route === '/intelligence' ? 0.9 : 0.7,
  }));
}

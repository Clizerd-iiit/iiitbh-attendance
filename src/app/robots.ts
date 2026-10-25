import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://attendance-system-gamma-five.vercel.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/auth/login', '/directory/', '/privacy', '/terms'],
        disallow: ['/admin/', '/teacher/', '/student/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
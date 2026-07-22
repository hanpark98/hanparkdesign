export const siteData = {
  url: 'https://hanparkdesign.com',
  siteName: 'Han Park Design',
  name: 'Han Park',
  alternateName: '박한결',
  jobTitle: 'Graphic Designer',
  experience: '4+ years of professional experience',
  taglineLead: 'I build demand for brands.',
  taglineDetail:
    'Creative direction, performance marketing, and DTC e-commerce, with a focus on growing K-beauty in North America.',
  description:
    'Han Park is a Seoul-based graphic designer with 4+ years of professional experience, helping brands build demand through graphic design, creative direction, performance marketing, and DTC e-commerce. His work focuses on growing K-beauty brands in North America, including projects for Olive Young and Mediheal. He is a 2023 Red Dot Award winner.',
  location: {
    city: 'Seoul',
    country: 'South Korea',
  },
  expertise: [
    'Graphic Design',
    'Creative Direction',
    'Performance Marketing',
    'DTC E-commerce',
    'K-beauty',
  ],
  clients: ['Olive Young', 'Mediheal'],
  achievement: '2023 Red Dot Award Winner — Brand & Communication Design',
  email: 'hanparkdesign@gmail.com',
  linkedin: 'https://www.linkedin.com/in/hanparkdesign/',
  image: '/images/website/profile-thumb.webp',
} as const;

export const personId = `${siteData.url}/#person`;
export const websiteId = `${siteData.url}/#website`;

export const personStructuredData = {
  '@type': 'Person',
  '@id': personId,
  name: siteData.name,
  alternateName: siteData.alternateName,
  url: siteData.url,
  image: new URL(siteData.image, siteData.url).href,
  jobTitle: siteData.jobTitle,
  description: siteData.description,
  email: siteData.email,
  sameAs: [siteData.linkedin],
  address: {
    '@type': 'PostalAddress',
    addressLocality: siteData.location.city,
    addressCountry: siteData.location.country,
  },
  knowsAbout: siteData.expertise,
  award: siteData.achievement,
  alumniOf: {
    '@type': 'CollegeOrUniversity',
    name: 'Seoul National University of Science and Technology',
    url: 'https://en.seoultech.ac.kr/',
  },
};

export const websiteStructuredData = {
  '@type': 'WebSite',
  '@id': websiteId,
  url: siteData.url,
  name: siteData.siteName,
  inLanguage: 'en',
  author: { '@id': personId },
};

import * as RNFS from '@dr.pogodin/react-native-fs';

export const FLAGS = {
  GLOBAL: 'https://utfs.io/f/ImOWJajUmXfyRKHTpylsELpB6QlYA4OdG9Jfr3hagoCN5Mzt',
  INDIA: 'https://utfs.io/f/ImOWJajUmXfyYCEwdELCDZIMxNG5H27Bouwvb4fyVJrdqj3X',
  ENGLISH: 'https://utfs.io/f/ImOWJajUmXfyN1E0dlnILrEMR3DJQX7OUvixCSHp6YWGNVPc',
  ITALY: 'https://utfs.io/f/ImOWJajUmXfynpGlTaXrTMAELcs2W76PyY4IRJVBXCHOofa5',
};

export const downloadFolder = RNFS.DownloadDirectoryPath + '/doodle';

export const themes: { name: string; color: string }[] = [
  {
    name: 'Doodle',
    color: '#FF6347',
  },
  {
    name: 'Hayasaka',
    color: '#00e6e6',
  },
  {
    name: 'Lavender',
    color: '#B2A4D4',
  },
  {
    name: 'Sky',
    color: '#87CEEB',
  },
  {
    name: 'Mint',
    color: '#98FB98',
  },
  {
    name: 'Sunset',
    color: '#FFA07A',
  },
  {
    name: 'Flix',
    color: '#E50914',
  },
  {
    name: 'Material',
    color: '#2196F3',
  },
  {
    name: 'Custom',
    color: '#FFFFFF',
  },
];

export const socialLinks = {
  github: 'https://github.com/punisher-303',
  instagram: 'https://instagram.com/appuz.404',
};

export const productionApps = {
  app1: {
    name: 'Echo Pulse Music',
    url: 'https://punisher-303.github.io/Echo-Pulse/', // Replace with actual URL
    icon: 'music', // Feather icon name
  },
  app2: {
    name: 'Doodle Windows',
    url: 'https://doodlemovies.vercel.app/', // Replace with actual URL
    icon: 'airplay', // Feather icon name
  },
  app3: {
    name: 'Doodle Web Play',
    url: 'https://doodle-movies.onrender.com/', // Replace with actual URL
    icon: 'chrome', // Feather icon name
  },
};

export const userAgents = [
  { name: 'Default (Android)', value: '' },
  { name: 'Chrome (Windows)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  { name: 'Firefox (Windows)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0' },
  { name: 'Safari (macOS)', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15' },
  { name: 'iPhone (iOS)', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1' },
  { name: 'Custom', value: 'custom' },
];

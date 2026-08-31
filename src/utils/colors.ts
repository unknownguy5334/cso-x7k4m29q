// Neutral, luxury color palette for course differentiation.
// Strictly neutral, stone, slate, obsidian, cashmere, terracotta, and sandstone tonals.

export interface CourseColor {
  name: string;
  bgLight: string;
  borderLight: string;
  textLight: string;
  bgDark: string;
  borderDark: string;
  textDark: string;
  bgHex: string;
  borderHex: string;
  textHex: string;
  swatchHex: string;
}

export const COURSE_PALETTE: CourseColor[] = [
  {
    name: 'Obsidian Charcoal',
    bgLight: '#F4F4F5',
    borderLight: '#D4D4D8',
    textLight: '#18181B',
    bgDark: '#18181B',
    borderDark: '#3F3F46',
    textDark: '#F4F4F5',
    bgHex: '#F4F4F5',
    borderHex: '#D4D4D8',
    textHex: '#18181B',
    swatchHex: '#27272A',
  },
  {
    name: 'Warm Slate',
    bgLight: '#F1F5F9',
    borderLight: '#CBD5E1',
    textLight: '#1E293B',
    bgDark: '#1E293B',
    borderDark: '#334155',
    textDark: '#F1F5F9',
    bgHex: '#F1F5F9',
    borderHex: '#CBD5E1',
    textHex: '#1E293B',
    swatchHex: '#475569',
  },
  {
    name: 'Cashmere Taupe',
    bgLight: '#F7F5F2',
    borderLight: '#DCD5CB',
    textLight: '#3D352E',
    bgDark: '#26221E',
    borderDark: '#443C34',
    textDark: '#EFECE6',
    bgHex: '#F7F5F2',
    borderHex: '#DCD5CB',
    textHex: '#3D352E',
    swatchHex: '#6E6155',
  },
  {
    name: 'Navy Mineral',
    bgLight: '#F0F4F8',
    borderLight: '#C9D7E4',
    textLight: '#1A2E40',
    bgDark: '#13212E',
    borderDark: '#253B50',
    textDark: '#DCE8F5',
    bgHex: '#F0F4F8',
    borderHex: '#C9D7E4',
    textHex: '#1A2E40',
    swatchHex: '#35506E',
  },
  {
    name: 'Sandstone Amber',
    bgLight: '#FAF6F0',
    borderLight: '#E3D7C5',
    textLight: '#433423',
    bgDark: '#292219',
    borderDark: '#453A2C',
    textDark: '#EFE6D8',
    bgHex: '#FAF6F0',
    borderHex: '#E3D7C5',
    textHex: '#433423',
    swatchHex: '#735E43',
  },
  {
    name: 'Deep Espresso',
    bgLight: '#F8F4F2',
    borderLight: '#DFD3CE',
    textLight: '#3D2821',
    bgDark: '#261B16',
    borderDark: '#44322B',
    textDark: '#EFE3DE',
    bgHex: '#F8F4F2',
    borderHex: '#DFD3CE',
    textHex: '#3D2821',
    swatchHex: '#69473B',
  },
  {
    name: 'Plum Mineral',
    bgLight: '#F5F2F7',
    borderLight: '#D9D0DF',
    textLight: '#342340',
    bgDark: '#23182C',
    borderDark: '#3F2D4E',
    textDark: '#EDE4F5',
    bgHex: '#F5F2F7',
    borderHex: '#D9D0DF',
    textHex: '#342340',
    swatchHex: '#5F4173',
  },
  {
    name: 'Steel Ash',
    bgLight: '#F3F4F6',
    borderLight: '#D1D5DB',
    textLight: '#1F2937',
    bgDark: '#1F2937',
    borderDark: '#374151',
    textDark: '#F3F4F6',
    bgHex: '#F3F4F6',
    borderHex: '#D1D5DB',
    textHex: '#1F2937',
    swatchHex: '#4B5563',
  },
  {
    name: 'Terracotta Earth',
    bgLight: '#FDF6F4',
    borderLight: '#EACDC5',
    textLight: '#4A2A22',
    bgDark: '#2B1A15',
    borderDark: '#4D2F27',
    textDark: '#FCECE8',
    bgHex: '#FDF6F4',
    borderHex: '#EACDC5',
    textHex: '#4A2A22',
    swatchHex: '#8C4D3B',
  },
  {
    name: 'Sage Spruce',
    bgLight: '#F2F6F4',
    borderLight: '#C9D8CF',
    textLight: '#1F382B',
    bgDark: '#172B20',
    borderDark: '#2C4939',
    textDark: '#E6EFEA',
    bgHex: '#F2F6F4',
    borderHex: '#C9D8CF',
    textHex: '#1F382B',
    swatchHex: '#3D614E',
  },
];

// Deterministically assign a color based on the course name or custom color index
export function getCourseColor(courseName: string, customColorIndex?: number): CourseColor {
  if (customColorIndex !== undefined && customColorIndex >= 0 && customColorIndex < COURSE_PALETTE.length) {
    return COURSE_PALETTE[customColorIndex];
  }
  if (!courseName) return COURSE_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COURSE_PALETTE.length;
  return COURSE_PALETTE[index];
}

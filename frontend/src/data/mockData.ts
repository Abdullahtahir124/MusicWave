import type { Song } from '../types';

export const MOCK_SONGS: Song[] = [
  { id:'m1', title:'Blinding Lights', artist:'The Weeknd', album:'After Hours', genre:'Synthpop', coverUrl:'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300', audioUrl:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', duration:200000, previewAvailable:true },
  { id:'m2', title:'Levitating', artist:'Dua Lipa', album:'Future Nostalgia', genre:'Pop', coverUrl:'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300', audioUrl:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', duration:203000, previewAvailable:true },
  { id:'m3', title:'Peaches', artist:'Justin Bieber', album:'Justice', genre:'R&B', coverUrl:'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300', audioUrl:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', duration:198000, previewAvailable:true },
  { id:'m4', title:'Stay', artist:'The Kid LAROI', album:'F*CK LOVE', genre:'Pop', coverUrl:'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300', audioUrl:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', duration:141000, previewAvailable:true },
  { id:'m5', title:'Industry Baby', artist:'Lil Nas X', album:'Montero', genre:'Hip-Hop', coverUrl:'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300', audioUrl:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', duration:212000, previewAvailable:true },
  { id:'m6', title:'Bad Habits', artist:'Ed Sheeran', album:'=', genre:'Pop', coverUrl:'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300', audioUrl:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', duration:231000, previewAvailable:true },
  { id:'m7', title:'Kiss Me More', artist:'Doja Cat', album:'Planet Her', genre:'R&B', coverUrl:'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300', audioUrl:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', duration:215000, previewAvailable:true },
  { id:'m8', title:'Save Your Tears', artist:'The Weeknd', album:'After Hours', genre:'Synthpop', coverUrl:'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300', audioUrl:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', duration:215000, previewAvailable:true },
  { id:'m9', title:'Montero', artist:'Lil Nas X', album:'Montero', genre:'Pop', coverUrl:'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300', audioUrl:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', duration:137000, previewAvailable:true },
  { id:'m10', title:'good 4 u', artist:'Olivia Rodrigo', album:'SOUR', genre:'Pop-Rock', coverUrl:'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300', audioUrl:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', duration:178000, previewAvailable:true },
];

export const FEATURED: Song = {
  id:'featured', title:'After Hours', artist:'The Weeknd', album:'After Hours', genre:'Synthpop',
  coverUrl:'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
  audioUrl:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  duration:361000, previewAvailable:true,
};

export const POPULAR_ARTISTS = [
  { id:'a1', name:'The Weeknd',   img:'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200' },
  { id:'a2', name:'Dua Lipa',     img:'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200' },
  { id:'a3', name:'Lil Nas X',    img:'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200' },
  { id:'a4', name:'Olivia Rodrigo',img:'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200' },
  { id:'a5', name:'Ed Sheeran',   img:'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200' },
  { id:'a6', name:'Doja Cat',     img:'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200' },
];

export const LOCAL_RECS: Song[] = MOCK_SONGS.map((s, i) => ({
  ...s, matchScore: 0.99 - i * 0.05,
}));

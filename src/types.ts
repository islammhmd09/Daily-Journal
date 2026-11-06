export type Lang = 'en' | 'ar';
export type Rating = 1 | 2 | 3 | 4 | 5 | null;

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD, one journal per day
  rating: Rating;
  dayText: string;
  feelings: string;
  story: string;
  forgiveness: string;
  createdAt: string;
  updatedAt: string;
}

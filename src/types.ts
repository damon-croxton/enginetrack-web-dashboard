export type Zone2Run = {
  Date_Str: string;              // "YYYY-MM-DD"
  Total_Distance_km: number;
  Duration_min: number;
  Avg_Speed_kmh: number;
  Avg_HR: number;
  Avg_eW_wkg: number;
  Aerobic_Power_Index: number;   // Main metric: (eW / HR) * 1000
};

export type IntervalSplit = {
  Step: string;                  // "Interval 1"
  Duration_Str: string;          // "4m 0s"
  Distance_km: number;
  Avg_Speed_kmh: number;
  Avg_HR: number;
};

export type Norwegian4x4Session = {
  Date_Str: string;
  Total_Work_Intervals: number;  // e.g. 4
  Avg_Speed_kmh: number;
  Avg_Work_HR: number;
  Total_Work_Distance_km: number;
  Peak_Interval_Speed: number;
  Peak_Interval_HR: number;
  Splits: IntervalSplit[];
};

export type MiscRun = {
  Date_Str: string;
  Total_Distance_km: number;
  Duration_min: number;
  Avg_Speed_kmh: number;
  Avg_HR: number;
  Workout_Type?: string;
  Notes?: string;
};

export type TabType = 'dashboard' | 'zone2' | 'norwegian4x4' | 'miscRuns' | 'trainingPlanner' | 'raceSimulator' | 'cardioLab';

export type TimeRangeOption = '30d' | '90d' | 'all';

export type Zone2SortField = 'Date_Str' | 'Aerobic_Power_Index' | 'Total_Distance_km' | 'Avg_HR' | 'Avg_Speed_kmh' | 'Avg_eW_wkg';
export type SortOrder = 'asc' | 'desc';

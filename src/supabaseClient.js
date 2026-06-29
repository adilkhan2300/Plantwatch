import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Detect if we should run in mock mode
const isMockMode =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.includes('your-project.supabase.co') ||
  supabaseUrl.includes('your_supabase_url') ||
  supabaseAnonKey.includes('your-supabase-anon-key') ||
  supabaseAnonKey.includes('your_supabase_anon_key');

// Setup mock client logic
class MockQueryBuilder {
  constructor(table, data) {
    this.table = table;
    this.data = data;
    this.currentData = [...data];
    this.isCountOnly = false;
  }

  select(columns, options) {
    if (options && options.count) {
      this.isCountOnly = true;
    }
    return this;
  }

  eq(column, value) {
    this.currentData = this.currentData.filter((item) => item[column] === value);
    return this;
  }

  in(column, values) {
    this.currentData = this.currentData.filter((item) => values.includes(item[column]));
    return this;
  }

  order(column, options = {}) {
    const { ascending = true } = options;
    this.currentData.sort((a, b) => {
      const valA = a[column];
      const valB = b[column];
      if (typeof valA === 'string') {
        return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return ascending ? valA - valB : valB - valA;
    });
    return this;
  }

  limit(num) {
    this.currentData = this.currentData.slice(0, num);
    return this;
  }

  async then(onfulfilled, onrejected) {
    try {
      const result = this.isCountOnly
        ? { data: null, error: null, count: this.currentData.length }
        : { data: this.currentData, error: null };
      return onfulfilled ? onfulfilled(result) : result;
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }

  async single() {
    if (this.currentData.length === 0) {
      return { data: null, error: new Error('Row not found') };
    }
    return { data: this.currentData[0], error: null };
  }

  insert(payload) {
    const isArray = Array.isArray(payload);
    const records = isArray ? payload : [payload];
    
    // Get current logged in user from mock session
    const sessionStr = localStorage.getItem('plantwatch_session');
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    const userId = session?.user?.id || 'user-123';

    const newRecords = records.map((r) => {
      const id = r.id || Math.random().toString(36).substring(2, 15);
      const created_at = new Date().toISOString();
      return {
        id,
        created_at,
        user_id: userId,
        ...r,
      };
    });

    const allData = [...this.data, ...newRecords];
    localStorage.setItem(`plantwatch_db_${this.table}`, JSON.stringify(allData));
    this.currentData = newRecords;
    return this;
  }

  update(payload) {
    const idsToUpdate = this.currentData.map((item) => item.id);
    const allData = this.data.map((item) => {
      if (idsToUpdate.includes(item.id)) {
        return { ...item, ...payload };
      }
      return item;
    });
    localStorage.setItem(`plantwatch_db_${this.table}`, JSON.stringify(allData));
    this.currentData = this.currentData.map((item) => ({ ...item, ...payload }));
    return this;
  }

  delete() {
    const idsToDelete = this.currentData.map((item) => item.id);
    const allData = this.data.filter((item) => !idsToDelete.includes(item.id));
    localStorage.setItem(`plantwatch_db_${this.table}`, JSON.stringify(allData));
    this.currentData = [];
    return this;
  }
}

class MockAuth {
  constructor() {
    this.listeners = [];
  }

  async getSession() {
    const session = localStorage.getItem('plantwatch_session');
    return { data: { session: session ? JSON.parse(session) : null }, error: null };
  }

  onAuthStateChange(callback) {
    this.listeners.push(callback);
    const session = localStorage.getItem('plantwatch_session');
    // Trigger callback immediately
    callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session ? JSON.parse(session) : null);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter((l) => l !== callback);
          },
        },
      },
    };
  }

  async signUp({ email, password, options = {} }) {
    const users = JSON.parse(localStorage.getItem('plantwatch_users') || '[]');
    if (users.find((u) => u.email === email)) {
      return { data: null, error: new Error('User already exists') };
    }
    const newUser = {
      id: Math.random().toString(36).substring(2, 15),
      email,
      user_metadata: options.data || {},
      created_at: new Date().toISOString(),
    };
    users.push({ ...newUser, password });
    localStorage.setItem('plantwatch_users', JSON.stringify(users));

    const session = {
      user: newUser,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    localStorage.setItem('plantwatch_session', JSON.stringify(session));
    
    // Auto-create Profile in mock DB
    const profiles = JSON.parse(localStorage.getItem('plantwatch_db_profiles') || '[]');
    const newProfile = {
      id: newUser.id,
      full_name: newUser.user_metadata.full_name || email.split('@')[0],
      avatar_url: '',
      created_at: new Date().toISOString()
    };
    profiles.push(newProfile);
    localStorage.setItem('plantwatch_db_profiles', JSON.stringify(profiles));

    this.listeners.forEach((l) => l('SIGNED_IN', session));
    return { data: { session, user: newUser }, error: null };
  }

  async signInWithPassword({ email, password }) {
    const users = JSON.parse(localStorage.getItem('plantwatch_users') || '[]');
    let user = users.find((u) => u.email === email && u.password === password);
    
    if (!user) {
      // For developer convenience, auto-create a user on login attempt
      const newUserId = Math.random().toString(36).substring(2, 15);
      user = {
        id: newUserId,
        email,
        user_metadata: { full_name: email.split('@')[0] },
        created_at: new Date().toISOString(),
      };
      users.push({ ...user, password });
      localStorage.setItem('plantwatch_users', JSON.stringify(users));

      // Create profile for this user
      const profiles = JSON.parse(localStorage.getItem('plantwatch_db_profiles') || '[]');
      profiles.push({
        id: newUserId,
        full_name: user.user_metadata.full_name,
        avatar_url: '',
        created_at: new Date().toISOString()
      });
      localStorage.setItem('plantwatch_db_profiles', JSON.stringify(profiles));
    }

    const session = {
      user,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    localStorage.setItem('plantwatch_session', JSON.stringify(session));

    this.listeners.forEach((l) => l('SIGNED_IN', session));
    return { data: { session, user }, error: null };
  }

  async signInWithOAuth({ provider }) {
    const dummyUser = {
      id: 'google-user-123',
      email: 'gardener@gmail.com',
      user_metadata: { full_name: 'Google Gardener' },
    };
    const session = { user: dummyUser, expires_at: Math.floor(Date.now() / 1000) + 3600 };
    localStorage.setItem('plantwatch_session', JSON.stringify(session));

    const profiles = JSON.parse(localStorage.getItem('plantwatch_db_profiles') || '[]');
    if (!profiles.some(p => p.id === dummyUser.id)) {
      profiles.push({
        id: dummyUser.id,
        full_name: dummyUser.user_metadata.full_name,
        avatar_url: '',
        created_at: new Date().toISOString()
      });
      localStorage.setItem('plantwatch_db_profiles', JSON.stringify(profiles));
    }

    this.listeners.forEach((l) => l('SIGNED_IN', session));
    return { data: { session, user: dummyUser }, error: null };
  }

  async signOut() {
    localStorage.removeItem('plantwatch_session');
    this.listeners.forEach((l) => l('SIGNED_OUT', null));
    return { error: null };
  }

  async resetPasswordForEmail() {
    return { data: {}, error: null };
  }
}

// Initial Seed Data Creator
const seedData = {
  profiles: [
    {
      id: 'google-user-123',
      full_name: 'Google Gardener',
      avatar_url: '',
      created_at: new Date().toISOString(),
    }
  ],
  plants: [
    {
      id: 'plant-1',
      name: 'Fiddle Leaf Fig',
      species: 'Ficus lyrata',
      emoji: '🌿',
      status: 'thriving',
      health: 92,
      height_cm: 120,
      potted_date: '2026-01-15',
      soil_type: 'Potting Soil Mix',
      sunlight: 'Bright Indirect Light',
      watering_interval_days: 7,
      last_watered: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days ago
      next_water: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],  // 4 days from now
      location_name: 'Living Room',
      location_lat: 37.7749,
      location_lng: -122.4194,
      floor: '1st Floor',
      is_indoor: true,
      color: '#2D6A4F',
    },
    {
      id: 'plant-2',
      name: 'Snake Plant',
      species: 'Sansevieria trifasciata',
      emoji: '🌵',
      status: 'stable',
      health: 85,
      height_cm: 45,
      potted_date: '2026-02-10',
      soil_type: 'Succulent/Cactus Mix',
      sunlight: 'Low Light',
      watering_interval_days: 14,
      last_watered: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 days ago
      next_water: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],  // 4 days from now
      location_name: 'Bedroom',
      location_lat: 37.7752,
      location_lng: -122.4201,
      floor: '1st Floor',
      is_indoor: true,
      color: '#1B4332',
    },
    {
      id: 'plant-3',
      name: 'Peace Lily',
      species: 'Spathiphyllum',
      emoji: '🌸',
      status: 'needs-care',
      health: 45,
      height_cm: 30,
      potted_date: '2026-03-01',
      soil_type: 'Peat Moss',
      sunlight: 'Medium Indirect Light',
      watering_interval_days: 5,
      last_watered: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 6 days ago (overdue)
      next_water: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],  // 1 day ago
      location_name: 'Kitchen',
      location_lat: 37.7745,
      location_lng: -122.4188,
      floor: 'Ground Floor',
      is_indoor: true,
      color: '#52B788',
    }
  ],
  sensor_readings: [
    { id: 'sr-1', plant_id: 'plant-1', temperature_c: 22.5, humidity_percent: 54, soil_moisture: 'Moist', light_level: 'Medium', recorded_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    { id: 'sr-2', plant_id: 'plant-1', temperature_c: 23.1, humidity_percent: 52, soil_moisture: 'Moist', light_level: 'Bright', recorded_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
    { id: 'sr-3', plant_id: 'plant-1', temperature_c: 22.2, humidity_percent: 56, soil_moisture: 'Moist', light_level: 'Medium', recorded_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
    
    { id: 'sr-4', plant_id: 'plant-2', temperature_c: 21.0, humidity_percent: 45, soil_moisture: 'Dry', light_level: 'Low', recorded_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
    
    { id: 'sr-5', plant_id: 'plant-3', temperature_c: 19.5, humidity_percent: 34, soil_moisture: 'Bone Dry', light_level: 'Medium', recorded_at: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
  ],
  growth_logs: [
    { id: 'gl-1', plant_id: 'plant-1', height_cm: 100, note: 'Initial height', logged_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'gl-2', plant_id: 'plant-1', height_cm: 108, note: 'Growing steady', logged_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'gl-3', plant_id: 'plant-1', height_cm: 114, note: 'Repotted into clay', logged_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'gl-4', plant_id: 'plant-1', height_cm: 120, note: 'Thriving beautifully', logged_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
    
    { id: 'gl-5', plant_id: 'plant-2', height_cm: 40, note: 'Added', logged_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'gl-6', plant_id: 'plant-2', height_cm: 45, note: 'Slow growth', logged_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
    
    { id: 'gl-7', plant_id: 'plant-3', height_cm: 28, note: 'Added', logged_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'gl-8', plant_id: 'plant-3', height_cm: 30, note: 'Looking dehydrated', logged_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() },
  ],
  care_logs: [
    { id: 'cl-1', plant_id: 'plant-1', action: 'Watered', note: 'Regular watering', logged_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'cl-2', plant_id: 'plant-1', action: 'Fertilized', note: 'Added 10-10-10 organic food', logged_at: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString() },
    
    { id: 'cl-3', plant_id: 'plant-2', action: 'Watered', note: 'Light water', logged_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
    
    { id: 'cl-4', plant_id: 'plant-3', action: 'Watered', note: 'Watered, but soil was very dry', logged_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() },
  ],
  issues: [
    { id: 'is-1', plant_id: 'plant-3', title: 'Yellowing leaves', description: 'Some of the lower leaves are starting to turn yellow, possibly due to overwatering or light issues.', logged_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), resolved: false, resolved_at: null }
  ]
};

const getMockTableData = (table) => {
  const data = localStorage.getItem(`plantwatch_db_${table}`);
  if (!data) {
    const seed = seedData[table] || [];
    localStorage.setItem(`plantwatch_db_${table}`, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(data);
};

const createMockSupabaseClient = () => {
  console.log('🌱 PlantWatch initialized in Offline LocalStorage Mock Mode');
  
  // Seed all tables initially
  Object.keys(seedData).forEach((table) => {
    if (!localStorage.getItem(`plantwatch_db_${table}`)) {
      localStorage.setItem(`plantwatch_db_${table}`, JSON.stringify(seedData[table]));
    }
  });

  return {
    auth: new MockAuth(),
    from: (table) => {
      const data = getMockTableData(table);
      return new MockQueryBuilder(table, data);
    },
    channel: (name) => {
      return {
        on(event, filter, callback) {
          // Store callbacks for mock real-time events if desired
          return this;
        },
        subscribe() {
          return {
            unsubscribe() {
              return true;
            },
          };
        },
        unsubscribe() {
          return true;
        },
      };
    },
  };
};

// Conditional Export
let clientInstance;

if (isMockMode) {
  clientInstance = createMockSupabaseClient();
} else {
  try {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('Failed to initialize real Supabase client. Falling back to Mock Mode.', err);
    clientInstance = createMockSupabaseClient();
  }
}

export const supabase = clientInstance;


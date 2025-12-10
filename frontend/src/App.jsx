import React, { useState, useEffect, createContext, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { 
  BookOpen, Trophy, Clock, Target, Menu, X, LogOut, 
  User, Home, PlayCircle, TrendingUp, Award, CheckCircle, Star
} from 'lucide-react';
import { UserPlus, Users } from 'lucide-react';
import config from './config';

fetch(`${config.apiUrl}/api/users`)

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'undefined' && supabaseAnonKey !== 'undefined';

const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

  // Admin client for user management
const supabaseAdmin = isSupabaseConfigured && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Auth Context
const AuthContext = createContext(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// Auth Provider with Supabase
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      const mockUser = localStorage.getItem('mockUser');
      if (mockUser) setUser(JSON.parse(mockUser));
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        ensureProfileExists(session.user);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      setUser(session?.user ?? null);
      if (session?.user && event === 'SIGNED_IN') {
        await ensureProfileExists(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const ensureProfileExists = async (user) => {
    try {
      console.log('Checking profile for user:', user.id);
      
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.log('Error fetching profile:', fetchError);
      }

      if (!profile) {
        console.log('Profile not found, creating...');
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email.split('@')[0]
          })
          .select()
          .single();

        if (insertError) {
          console.log('Profile creation error:', insertError);
        } else {
          console.log('Profile created successfully:', newProfile);
        }
      } else {
        console.log('Profile exists:', profile);
      }
    } catch (error) {
      console.log('Profile check error:', error.message);
    }
  };

  const login = async (email, password) => {
    if (!supabase) {
      const mockUser = { 
        id: '1', 
        email, 
        user_metadata: { full_name: email.split('@')[0] }
      };
      localStorage.setItem('mockUser', JSON.stringify(mockUser));
      setUser(mockUser);
      return { user: mockUser };
    }

    console.log('Attempting login for:', email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('Login error:', error);
      alert('Login failed: ' + error.message);
      throw error;
    }

    console.log('Login successful:', data.user?.email);

    if (data.user) {
      await ensureProfileExists(data.user);
    }
    
    return data;
  };

  const signup = async (email, password, fullName) => {
    if (!supabase) {
      alert('Supabase not configured. Using demo mode.');
      return login(email, password);
    }

    try {
      console.log('Starting signup for:', email);
      
      // Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'http://localhost:5173',
          data: {
            full_name: fullName || email.split('@')[0]
          }
        }
      });
      
      console.log('Signup response:', { data, error });
      
      if (error) {
        console.error('Signup error:', error);
        throw error;
      }

      // If user was created successfully
      if (data.user) {
        console.log('User created:', data.user.id);
        
        // Try to create profile
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              email: data.user.email,
              full_name: fullName || email.split('@')[0]
            })
            .select()
            .single();
          
          if (profileError) {
            console.log('Profile creation failed (will retry on login):', profileError);
          } else {
            console.log('Profile created successfully:', profile);
          }
        } catch (profileErr) {
          console.log('Profile creation error (will retry on login):', profileErr);
        }

        // Check if email confirmation is disabled
        if (data.session) {
          alert('Account created successfully! Welcome!');
        } else {
          alert('Account created! Please check your email to confirm.');
        }
        
        return data;
      }
      
    } catch (error) {
      console.error('Signup failed:', error);
      alert('Signup failed: ' + error.message);
      throw error;
    }
  };

  const logout = async () => {
    if (!supabase) {
      localStorage.removeItem('mockUser');
      setUser(null);
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, isSupabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Page
const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, signup, isSupabaseConfigured } = useAuth();

  const handleSubmit = async () => {
    if (!email || !password) {
      alert('Please enter email and password');
      return;
    }

    if (!isLogin && !fullName && isSupabaseConfigured) {
      alert('Please enter your full name');
      return;
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password, fullName);
      }
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        {!isSupabaseConfigured && (
          <div style={{ 
            padding: '12px', 
            background: '#fef3c7', 
            borderRadius: '8px', 
            marginBottom: '16px',
            border: '1px solid #fbbf24'
          }}>
            <p style={{ fontSize: '14px', color: '#92400e', textAlign: 'center' }}>
              ⚠️ Demo Mode: Supabase not configured
            </p>
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-block',
            padding: '12px',
            background: '#e0e7ff',
            borderRadius: '12px',
            marginBottom: '16px'
          }}>
            <BookOpen size={32} color="#4f46e5" />
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
            eSim Triangle
          </h1>
          <p style={{ color: '#6b7280' }}>Master the Triangle Inequality Theorem</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button
            onClick={() => setIsLogin(true)}
            style={{
              flex: 1,
              padding: '8px',
              background: isLogin ? '#4f46e5' : '#e5e7eb',
              color: isLogin ? 'white' : '#6b7280',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            style={{
              flex: 1,
              padding: '8px',
              background: !isLogin ? '#4f46e5' : '#e5e7eb',
              color: !isLogin ? 'white' : '#6b7280',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Sign Up
          </button>
        </div>

        {!isLogin && (
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading}
            />
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSubmit()}
            disabled={isLoading}
          />
        </div>

        <button 
          onClick={handleSubmit} 
          style={{ width: '100%' }}
          disabled={isLoading}
        >
          {isLoading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
        </button>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#6b7280' }}>
          {isSupabaseConfigured 
            ? (isLogin ? 'Create an account to get started' : 'Check console (F12) for detailed logs')
            : 'Demo: Use any email/password to login'
          }
        </p>
      </div>
    </div>
  );
};

// Admin User Management
const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', fullName: '' });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.fullName) {
      alert('Please fill all fields');
      return;
    }

    setIsCreating(true);
    try {
      console.log('Creating user:', newUser.email);

      // Create auth user using admin API
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: newUser.email,
        password: newUser.password,
        email_confirm: true,
        user_metadata: {
          full_name: newUser.fullName
        }
      });

      if (authError) throw authError;

      console.log('Auth user created:', authData.user.id);

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: newUser.email,
          full_name: newUser.fullName
        });

      if (profileError) throw profileError;

      alert(`User created successfully!\n\nEmail: ${newUser.email}\nPassword: ${newUser.password}\n\nShare these credentials with the student.`);
      
      setNewUser({ email: '', password: '', fullName: '' });
      setShowAddUser(false);
      loadUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const deleteUser = async (userId, email) => {
    if (!confirm(`Delete user ${email}?`)) return;

    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;

      alert('User deleted successfully');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
        <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading users...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
            User Management
          </h1>
          <p style={{ color: '#6b7280' }}>Create and manage student accounts</p>
        </div>
        <button
          onClick={() => setShowAddUser(!showAddUser)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <UserPlus size={20} />
          Add User
        </button>
      </div>

      {showAddUser && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Create New User</h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
              Full Name
            </label>
            <input
              type="text"
              placeholder="John Doe"
              value={newUser.fullName}
              onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
              disabled={isCreating}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
              Email
            </label>
            <input
              type="email"
              placeholder="student@example.com"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              disabled={isCreating}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
              Password
            </label>
            <input
              type="text"
              placeholder="Minimum 6 characters"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              disabled={isCreating}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Note: Save this password - you'll need to share it with the student
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={createUser}
              disabled={isCreating}
              style={{ flex: 1 }}
            >
              {isCreating ? 'Creating...' : 'Create User'}
            </button>
            <button
              onClick={() => setShowAddUser(false)}
              disabled={isCreating}
              style={{ flex: 1, background: '#e5e7eb', color: '#374151' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          All Users ({users.length})
        </h3>

        {users.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>
            No users yet. Click "Add User" to create one.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Name</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Email</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Role</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Created</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '32px', height: '32px', background: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={16} color="#4f46e5" />
                        </div>
                        <span style={{ fontWeight: '500' }}>{user.full_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: '#6b7280' }}>{user.email}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '12px',
                        fontWeight: '500',
                        background: user.role === 'admin' ? '#dbeafe' : '#d1fae5',
                        color: user.role === 'admin' ? '#1e40af' : '#065f46'
                      }}>
                        {user.role || 'student'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: '#6b7280', fontSize: '14px' }}>
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={() => deleteUser(user.id, user.email)}
                        style={{
                          padding: '6px 12px',
                          background: '#fee2e2',
                          color: '#991b1b',
                          fontSize: '12px',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
// Dashboard Component
const Dashboard = () => {
  const progressData = [
    { week: 'Week 1', progress: 45 },
    { week: 'Week 2', progress: 62 },
    { week: 'Week 3', progress: 78 },
    { week: 'Week 4', progress: 85 },
  ];

  const stats = [
    { label: 'Lessons Completed', value: '12/20', icon: BookOpen, color: '#3b82f6' },
    { label: 'Current Streak', value: '7 days', icon: Clock, color: '#10b981' },
    { label: 'Total Points', value: '450', icon: Trophy, color: '#f59e0b' },
    { label: 'Avg Score', value: '85%', icon: Target, color: '#8b5cf6' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
          Welcome back! 👋
        </h1>
        <p style={{ color: '#6b7280' }}>Keep up the great work on your learning journey</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {stats.map((stat, idx) => (
          <div key={idx} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>{stat.label}</p>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{stat.value}</p>
            </div>
            <div style={{ padding: '12px', background: `${stat.color}20`, borderRadius: '12px' }}>
              <stat.icon size={24} color={stat.color} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        <div className="card">
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Learning Progress</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip />
              <Line type="monotone" dataKey="progress" stroke="#4f46e5" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Recent Achievements</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {['First Steps', 'Week Warrior', 'Triangle Master'].map((achievement, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'linear-gradient(90deg, #fef3c7 0%, #fed7aa 100%)', borderRadius: '8px' }}>
                <Award size={32} color="#f59e0b" />
                <div>
                  <p style={{ fontWeight: '600', color: '#1f2937' }}>{achievement}</p>
                  <p style={{ fontSize: '14px', color: '#6b7280' }}>Earned 2 days ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Learning Materials
const LearningMaterials = () => {
  const materials = [
    { id: 1, title: 'Introduction to Triangles', duration: '15 min', completed: true, difficulty: 'Beginner' },
    { id: 2, title: 'Triangle Inequality Theorem', duration: '20 min', completed: true, difficulty: 'Beginner' },
    { id: 3, title: 'Interactive Triangle Builder', duration: '30 min', completed: false, difficulty: 'Intermediate' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '32px' }}>Learning Materials</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {materials.map((material) => (
          <div key={material.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ padding: '12px', background: material.completed ? '#d1fae5' : '#e0e7ff', borderRadius: '12px' }}>
                <BookOpen size={24} color={material.completed ? '#10b981' : '#4f46e5'} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>{material.title}</h3>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>{material.duration} • {material.difficulty}</p>
              </div>
            </div>
            <button>{material.completed ? 'Review' : 'Start'}</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Triangle Tool
const TriangleTool = () => {
  const [sideA, setSideA] = useState(5);
  const [sideB, setSideB] = useState(7);
  const [sideC, setSideC] = useState(9);
  const isValid = (sideA + sideB > sideC) && (sideA + sideC > sideB) && (sideB + sideC > sideA);

  return (
    <div>
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '32px' }}>Interactive Triangle Builder</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        <div className="card">
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>Side Lengths</h3>
          {[
            { label: 'Side A', value: sideA, setValue: setSideA },
            { label: 'Side B', value: sideB, setValue: setSideB },
            { label: 'Side C', value: sideC, setValue: setSideC }
          ].map(({ label, value, setValue }) => (
            <div key={label} style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                {label} <span style={{ color: '#4f46e5' }}>{value} units</span>
              </label>
              <input type="range" min="1" max="20" value={value} onChange={(e) => setValue(Number(e.target.value))} />
            </div>
          ))}
          <div style={{ padding: '16px', borderRadius: '8px', border: `2px solid ${isValid ? '#10b981' : '#ef4444'}`, background: isValid ? '#d1fae5' : '#fee2e2' }}>
            <p style={{ fontWeight: '600', color: isValid ? '#065f46' : '#991b1b', marginBottom: '8px' }}>
              {isValid ? '✓ Valid Triangle!' : '✗ Invalid Triangle'}
            </p>
            <p style={{ fontSize: '14px' }}>
              {isValid ? 'All inequalities satisfied!' : 'Sum of any two sides must be greater than the third.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Progress Page
const Progress = () => {
  return (
    <div>
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '32px' }}>Your Progress</h1>
      <div className="card"><p>Progress tracking coming soon...</p></div>
    </div>
  );
};

// Main App
const App = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', border: '4px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6b7280' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

const navigation = [
  { name: 'Dashboard', icon: Home, page: 'dashboard' },
  { name: 'Learning Materials', icon: BookOpen, page: 'materials' },
  { name: 'Triangle Tool', icon: PlayCircle, page: 'tool' },
  { name: 'My Progress', icon: TrendingUp, page: 'progress' },
  { name: 'User Management', icon: Users, page: 'admin' },
];

  const renderPage = () => {
  switch(currentPage) {
    case 'dashboard': return <Dashboard />;
    case 'materials': return <LearningMaterials />;
    case 'tool': return <TriangleTool />;
    case 'progress': return <Progress />;
    case 'admin': return <AdminPanel />;
    default: return <Dashboard />;
  }
};

  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student';

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <aside style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: '256px', background: 'white', borderRight: '1px solid #e5e7eb', transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.3s', zIndex: 50 }} className="sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px', background: '#e0e7ff', borderRadius: '8px' }}>
                <BookOpen size={24} color="#4f46e5" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>eSim Triangle</h2>
            </div>
          </div>
          <nav style={{ flex: 1, padding: '16px' }}>
            {navigation.map((item) => (
              <button key={item.name} onClick={() => { setCurrentPage(item.page); setSidebarOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '8px', background: currentPage === item.page ? '#e0e7ff' : 'transparent', color: currentPage === item.page ? '#4f46e5' : '#6b7280', marginBottom: '4px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
                <item.icon size={20} />
                {item.name}
              </button>
            ))}
          </nav>
          <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', background: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={20} color="#4f46e5" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</p>
                <p style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</p>
              </div>
            </div>
            <button onClick={logout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', color: '#ef4444', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div style={{ marginLeft: '0', transition: 'margin-left 0.3s' }} className="main-content">
        <header style={{ background: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 40, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ padding: '8px', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#fef3c7', borderRadius: '8px' }}>
            <Trophy size={20} color="#f59e0b" />
            <span style={{ fontWeight: '600', color: '#92400e' }}>450 pts</span>
          </div>
        </header>
        <main style={{ padding: '32px 24px' }}>
          {renderPage()}
        </main>
      </div>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 40 }} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 1024px) {
          .sidebar { transform: translateX(0) !important; }
          .main-content { margin-left: 256px !important; }
        }
      `}</style>
    </div>
  );
};

export default function Root() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
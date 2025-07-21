import React, { createContext, useContext, useState, useEffect } from 'react';

interface VendorUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
}

interface VendorAuthContextType {
  vendorUser: VendorUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
  isInitializing: boolean;
}

const VendorAuthContext = createContext<VendorAuthContextType | undefined>(undefined);

export const useVendorAuth = () => {
  const context = useContext(VendorAuthContext);
  if (!context) {
    throw new Error('useVendorAuth must be used within a VendorAuthProvider');
  }
  return context;
};

export const VendorAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vendorUser, setVendorUser] = useState<VendorUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('vendor_token'));
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Verify token on load
    if (token) {
      verifyToken();
    } else {
      setIsInitializing(false);
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch('/vendor-api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const { vendorUser } = await response.json();
        setVendorUser(vendorUser);
      } else {
        // Token invalid, clear it
        localStorage.removeItem('vendor_token');
        setToken(null);
        setVendorUser(null);
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('vendor_token');
      setToken(null);
      setVendorUser(null);
    } finally {
      setIsInitializing(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const response = await fetch('/vendor-api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.token);
        setVendorUser(data.vendorUser);
        localStorage.setItem('vendor_token', data.token);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch('/vendor-api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('vendor_token');
      setToken(null);
      setVendorUser(null);
    }
  };

  return (
    <VendorAuthContext.Provider value={{ vendorUser, token, login, logout, isLoading, isInitializing }}>
      {children}
    </VendorAuthContext.Provider>
  );
};
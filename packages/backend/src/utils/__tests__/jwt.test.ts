import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../jwt';

// Set up test environment variables
const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    JWT_SECRET: 'test-jwt-secret-key-for-unit-tests-minimum-32-characters-long',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-key-for-unit-tests-minimum-32-characters-long',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('JWT Utilities', () => {
  const mockPayload = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    role: 'supplier_admin',
    tenantType: 'supplier',
  };

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(mockPayload);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should throw error if JWT_SECRET is not configured', () => {
      delete process.env.JWT_SECRET;

      expect(() => {
        generateAccessToken(mockPayload);
      }).toThrow('JWT_SECRET not configured');
    });

    it('should generate different tokens for different payloads', () => {
      const token1 = generateAccessToken(mockPayload);
      const token2 = generateAccessToken({
        ...mockPayload,
        userId: 'user-789',
      });

      expect(token1).not.toBe(token2);
    });

    it('should use custom expiresIn from environment', () => {
      process.env.JWT_EXPIRES_IN = '30m';
      const token = generateAccessToken(mockPayload);

      expect(token).toBeTruthy();
      // Token should be valid
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(mockPayload.userId);
    });

    it('should use default expiresIn if not set', () => {
      delete process.env.JWT_EXPIRES_IN;
      const token = generateAccessToken(mockPayload);

      expect(token).toBeTruthy();
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(mockPayload.userId);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(mockPayload);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should throw error if JWT_REFRESH_SECRET is not configured', () => {
      delete process.env.JWT_REFRESH_SECRET;

      expect(() => {
        generateRefreshToken(mockPayload);
      }).toThrow('JWT_REFRESH_SECRET not configured');
    });

    it('should generate different tokens than access tokens', () => {
      const accessToken = generateAccessToken(mockPayload);
      const refreshToken = generateRefreshToken(mockPayload);

      expect(accessToken).not.toBe(refreshToken);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = verifyAccessToken(token);

      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.tenantId).toBe(mockPayload.tenantId);
      expect(decoded.role).toBe(mockPayload.role);
      expect(decoded.tenantType).toBe(mockPayload.tenantType);
    });

    it('should throw error if JWT_SECRET is not configured', () => {
      const token = generateAccessToken(mockPayload);
      delete process.env.JWT_SECRET;

      expect(() => {
        verifyAccessToken(token);
      }).toThrow('JWT_SECRET not configured');
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        verifyAccessToken(invalidToken);
      }).toThrow();
    });

    it('should throw error for token signed with wrong secret', () => {
      const token = generateAccessToken(mockPayload);
      process.env.JWT_SECRET = 'wrong-secret-key-for-unit-tests-minimum-32-characters-long';

      expect(() => {
        verifyAccessToken(token);
      }).toThrow();
    });

    it('should throw error for expired token', async () => {
      process.env.JWT_EXPIRES_IN = '1ms'; // Very short expiry
      
      const token = generateAccessToken(mockPayload);
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(() => {
        verifyAccessToken(token);
      }).toThrow();
    });

    it('should throw error for empty token', () => {
      expect(() => {
        verifyAccessToken('');
      }).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken(mockPayload);
      const decoded = verifyRefreshToken(token);

      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.tenantId).toBe(mockPayload.tenantId);
      expect(decoded.role).toBe(mockPayload.role);
      expect(decoded.tenantType).toBe(mockPayload.tenantType);
    });

    it('should throw error if JWT_REFRESH_SECRET is not configured', () => {
      const token = generateRefreshToken(mockPayload);
      delete process.env.JWT_REFRESH_SECRET;

      expect(() => {
        verifyRefreshToken(token);
      }).toThrow('JWT_REFRESH_SECRET not configured');
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        verifyRefreshToken(invalidToken);
      }).toThrow();
    });

    it('should not verify access token as refresh token', () => {
      const accessToken = generateAccessToken(mockPayload);

      expect(() => {
        verifyRefreshToken(accessToken);
      }).toThrow();
    });

    it('should not verify refresh token as access token', () => {
      const refreshToken = generateRefreshToken(mockPayload);

      expect(() => {
        verifyAccessToken(refreshToken);
      }).toThrow();
    });
  });

  describe('Token generation and verification integration', () => {
    it('should generate and verify access token correctly', () => {
      const payload = {
        userId: 'user-999',
        tenantId: 'tenant-888',
        role: 'company_admin',
        tenantType: 'company',
      };

      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded).toMatchObject(payload);
    });

    it('should generate and verify refresh token correctly', () => {
      const payload = {
        userId: 'user-777',
        tenantId: 'tenant-666',
        role: 'super_admin',
        tenantType: 'system',
      };

      const token = generateRefreshToken(payload);
      const decoded = verifyRefreshToken(token);

      expect(decoded).toMatchObject(payload);
    });
  });
});


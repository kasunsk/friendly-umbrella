import { hashPassword, comparePassword } from '../password';

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password successfully', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
      expect(hash).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash format
    });

    it('should produce different hashes for the same password', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // Different salts should produce different hashes
    });

    it('should handle empty password', async () => {
      const hash = await hashPassword('');
      expect(hash).toBeTruthy();
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should handle special characters in password', async () => {
      const password = 'P@ssw0rd!@#$%^&*()';
      const hash = await hashPassword(password);

      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
    });

    it('should handle long passwords', async () => {
      const password = 'a'.repeat(200); // Very long password
      const hash = await hashPassword(password);

      expect(hash).toBeTruthy();
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password and hash', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      const result = await comparePassword(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      const wrongPassword = 'wrongPassword';

      const result = await comparePassword(wrongPassword, hash);
      expect(result).toBe(false);
    });

    it('should return false for empty password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      const result = await comparePassword('', hash);
      expect(result).toBe(false);
    });

    it('should return false for empty hash', async () => {
      const password = 'testPassword123';

      const result = await comparePassword(password, '');
      expect(result).toBe(false);
    });

    it('should handle case-sensitive passwords', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      const result1 = await comparePassword('TestPassword123', hash);
      const result2 = await comparePassword('testpassword123', hash);
      const result3 = await comparePassword('TESTPASSWORD123', hash);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });

    it('should handle special characters correctly', async () => {
      const password = 'P@ssw0rd!@#$%';
      const hash = await hashPassword(password);

      const result1 = await comparePassword('P@ssw0rd!@#$%', hash);
      const result2 = await comparePassword('P@ssw0rd!@#$', hash); // Missing last char

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });
  });

  describe('Password hashing and comparison integration', () => {
    it('should hash and verify password correctly', async () => {
      const password = 'mySecurePassword123';
      const hash = await hashPassword(password);
      const isValid = await comparePassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should not verify password with different hash', async () => {
      const password = 'mySecurePassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword('differentPassword');

      const result1 = await comparePassword(password, hash2);
      const result2 = await comparePassword('differentPassword', hash1);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });
  });
});


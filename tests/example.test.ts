/**
 * Example Test Suite
 *
 * This file demonstrates basic Jest testing patterns for TypeScript.
 * Use this as a template when writing new tests.
 */

describe('Example Test Suite', () => {
  test('should pass basic assertion', () => {
    // Arrange
    const expected = true;

    // Act
    const actual = true;

    // Assert
    expect(actual).toBe(expected);
  });

  test('should handle async operations', async () => {
    // Arrange
    const mockAsyncFunction = async (): Promise<string> => {
      return new Promise(resolve => {
        setTimeout(() => resolve('success'), 10);
      });
    };

    // Act
    const result = await mockAsyncFunction();

    // Assert
    expect(result).toBe('success');
  });

  test('should work with objects', () => {
    // Arrange
    const user = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
    };

    // Act & Assert
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('name', 'Test User');
    expect(user).toMatchObject({
      id: expect.any(Number),
      name: expect.any(String),
      email: expect.stringContaining('@'),
    });
  });

  test('should work with arrays', () => {
    // Arrange
    const numbers = [1, 2, 3, 4, 5];

    // Act & Assert
    expect(numbers).toHaveLength(5);
    expect(numbers).toContain(3);
    expect(numbers).toEqual(expect.arrayContaining([1, 5]));
  });

  describe('nested describe blocks', () => {
    test('should support test organization', () => {
      // Nested describes help organize related tests
      expect(true).toBeTruthy();
    });
  });
});

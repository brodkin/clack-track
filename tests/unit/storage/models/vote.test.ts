import { VoteModel } from '../../../../src/storage/models/index.js';
import { Database } from '../../../../src/storage/database.js';

describe('VoteModel', () => {
  let db: Database;
  let voteModel: VoteModel;

  beforeEach(async () => {
    db = new Database();
    await db.connect();
    await db.migrate();
    voteModel = new VoteModel(db);
  });

  afterEach(async () => {
    await db.disconnect();
  });

  describe('create', () => {
    test('should create a vote record with all fields', async () => {
      const voteData = {
        contentId: 'content-1',
        vote: 'good' as const,
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      const result = await voteModel.create(voteData);

      expect(result).toMatchObject({
        contentId: 'content-1',
        vote: 'good',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      });
      expect(result.id).toBeDefined();
      expect(result.votedAt).toBeInstanceOf(Date);
    });

    test('should create a vote record with minimal fields', async () => {
      const voteData = {
        contentId: 'content-1',
        vote: 'bad' as const,
      };

      const result = await voteModel.create(voteData);

      expect(result).toMatchObject({
        contentId: 'content-1',
        vote: 'bad',
      });
      expect(result.id).toBeDefined();
      expect(result.votedAt).toBeInstanceOf(Date);
    });

    test('should generate unique IDs for each vote', async () => {
      const vote1 = await voteModel.create({
        contentId: 'content-1',
        vote: 'good',
      });

      const vote2 = await voteModel.create({
        contentId: 'content-1',
        vote: 'bad',
      });

      expect(vote1.id).not.toBe(vote2.id);
    });

    test('should accept both good and bad vote types', async () => {
      const goodVote = await voteModel.create({
        contentId: 'content-1',
        vote: 'good',
      });

      const badVote = await voteModel.create({
        contentId: 'content-2',
        vote: 'bad',
      });

      expect(goodVote.vote).toBe('good');
      expect(badVote.vote).toBe('bad');
    });
  });

  describe('findByContentId', () => {
    test('should find all votes for a specific content ID', async () => {
      await voteModel.create({
        contentId: 'content-1',
        vote: 'good',
      });

      await voteModel.create({
        contentId: 'content-1',
        vote: 'bad',
      });

      await voteModel.create({
        contentId: 'content-2',
        vote: 'good',
      });

      const votes = await voteModel.findByContentId('content-1');

      expect(votes).toHaveLength(2);
      expect(votes.every(v => v.contentId === 'content-1')).toBe(true);
    });

    test('should return empty array when no votes found', async () => {
      const votes = await voteModel.findByContentId('nonexistent');

      expect(votes).toEqual([]);
    });

    test('should return votes in descending order by timestamp', async () => {
      const vote1 = await voteModel.create({
        contentId: 'content-1',
        vote: 'good',
      });

      // Wait a tiny bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const vote2 = await voteModel.create({
        contentId: 'content-1',
        vote: 'bad',
      });

      const votes = await voteModel.findByContentId('content-1');

      expect(votes[0].id).toBe(vote2.id);
      expect(votes[1].id).toBe(vote1.id);
    });

    test('should preserve vote type and metadata', async () => {
      await voteModel.create({
        contentId: 'content-1',
        vote: 'good',
        userAgent: 'Test Agent',
        ipAddress: '127.0.0.1',
      });

      const votes = await voteModel.findByContentId('content-1');

      expect(votes[0].vote).toBe('good');
      expect(votes[0].userAgent).toBe('Test Agent');
      expect(votes[0].ipAddress).toBe('127.0.0.1');
    });
  });

  describe('getStats', () => {
    test('should return zero stats when no votes exist', async () => {
      const stats = await voteModel.getStats();

      expect(stats.good).toBe(0);
      expect(stats.bad).toBe(0);
      expect(stats.ratio).toBe(0);
    });

    test('should calculate correct stats with single vote type', async () => {
      await voteModel.create({ contentId: 'content-1', vote: 'good' });
      await voteModel.create({ contentId: 'content-2', vote: 'good' });
      await voteModel.create({ contentId: 'content-3', vote: 'good' });

      const stats = await voteModel.getStats();

      expect(stats.good).toBe(3);
      expect(stats.bad).toBe(0);
      expect(stats.ratio).toBe(1);
    });

    test('should calculate correct stats with mixed votes', async () => {
      await voteModel.create({ contentId: 'content-1', vote: 'good' });
      await voteModel.create({ contentId: 'content-2', vote: 'good' });
      await voteModel.create({ contentId: 'content-3', vote: 'bad' });

      const stats = await voteModel.getStats();

      expect(stats.good).toBe(2);
      expect(stats.bad).toBe(1);
      expect(stats.ratio).toBeCloseTo(0.666, 2);
    });

    test('should calculate correct ratio with all bad votes', async () => {
      await voteModel.create({ contentId: 'content-1', vote: 'bad' });
      await voteModel.create({ contentId: 'content-2', vote: 'bad' });

      const stats = await voteModel.getStats();

      expect(stats.good).toBe(0);
      expect(stats.bad).toBe(2);
      expect(stats.ratio).toBe(0);
    });

    test('should calculate correct ratio with equal good and bad votes', async () => {
      await voteModel.create({ contentId: 'content-1', vote: 'good' });
      await voteModel.create({ contentId: 'content-2', vote: 'bad' });

      const stats = await voteModel.getStats();

      expect(stats.good).toBe(1);
      expect(stats.bad).toBe(1);
      expect(stats.ratio).toBe(0.5);
    });
  });

  describe('findById', () => {
    test('should find a vote by ID', async () => {
      const created = await voteModel.create({
        contentId: 'content-1',
        vote: 'good',
      });

      const found = await voteModel.findById(created.id);

      expect(found).toMatchObject({
        id: created.id,
        contentId: 'content-1',
        vote: 'good',
      });
    });

    test('should return null for nonexistent ID', async () => {
      const found = await voteModel.findById(99999);

      expect(found).toBeNull();
    });
  });

  describe('deleteByContentId', () => {
    test('should delete all votes for a content ID', async () => {
      await voteModel.create({ contentId: 'content-1', vote: 'good' });
      await voteModel.create({ contentId: 'content-1', vote: 'bad' });
      await voteModel.create({ contentId: 'content-2', vote: 'good' });

      const deleted = await voteModel.deleteByContentId('content-1');

      expect(deleted).toBe(2);

      const remaining = await voteModel.findByContentId('content-1');
      expect(remaining).toHaveLength(0);

      const content2Votes = await voteModel.findByContentId('content-2');
      expect(content2Votes).toHaveLength(1);
    });

    test('should return 0 when deleting nonexistent content', async () => {
      const deleted = await voteModel.deleteByContentId('nonexistent');

      expect(deleted).toBe(0);
    });
  });
});

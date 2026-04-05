describe('GitHub integration', () => {
  it('postPRComment is exported and callable', () => {
    const { postPRComment } = require('../src/github');
    expect(typeof postPRComment).toBe('function');
  });

  it('module exports expected functions', () => {
    const github = require('../src/github');
    expect(github).toHaveProperty('postPRComment');
  });
});

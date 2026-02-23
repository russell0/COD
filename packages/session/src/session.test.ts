import { describe, it, expect } from 'vitest';
import { Session } from './session.js';

describe('Session', () => {
  it('starts empty', () => {
    const session = new Session('test-id');
    expect(session.id).toBe('test-id');
    expect(session.getMessages()).toHaveLength(0);
    expect(session.getMessageCount()).toBe(0);
  });

  it('adds user messages', () => {
    const session = new Session();
    session.addUserMessage('Hello');
    const msgs = session.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.role).toBe('user');
    expect(msgs[0]?.content[0]).toMatchObject({ type: 'text', text: 'Hello' });
  });

  it('adds assistant messages', () => {
    const session = new Session();
    session.addAssistantMessage([{ type: 'text', text: 'Hi there' }]);
    const msgs = session.getMessages();
    expect(msgs[0]?.role).toBe('assistant');
  });

  it('adds tool results', () => {
    const session = new Session();
    session.addToolResults([
      { toolCallId: 'call-1', result: { type: 'text', text: 'result' } },
    ]);
    const msgs = session.getMessages();
    expect(msgs[0]?.role).toBe('user');
    expect(msgs[0]?.content[0]?.type).toBe('tool_result');
  });

  it('clears messages', () => {
    const session = new Session();
    session.addUserMessage('Hello');
    session.clear();
    expect(session.getMessages()).toHaveLength(0);
  });

  it('replaces with summary keeping last N messages', () => {
    const session = new Session();
    for (let i = 0; i < 20; i++) {
      session.addUserMessage(`Message ${i}`);
    }
    session.replaceWithSummary('Summary of conversation', 4);
    // Should have: summary user msg + summary assistant msg + 4 kept msgs = 6
    expect(session.getMessageCount()).toBe(6);
    expect(session.getMessages()[0]?.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Summary of conversation'),
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpeechSynthesisController } from '../src/services/speechController';

describe('Speech Synthesis Controller Service', () => {
  let controller: SpeechSynthesisController;

  beforeEach(() => {
    controller = new SpeechSynthesisController();
  });

  it('reports supported status in window environment', () => {
    expect(controller.isSupported()).toBe(true);
    expect(controller.getState().supported).toBe(true);
    expect(controller.getState().status).toBe('idle');
  });

  it('transitions state through speak, pause, resume, and stop', () => {
    const states: string[] = [];
    const unsubscribe = controller.subscribe((s) => {
      states.push(s.status);
    });

    controller.speak('هذا اختبار صوتي');
    expect(controller.getState().status).toBe('speaking');

    controller.pause();
    expect(controller.getState().status).toBe('paused');

    controller.resume();
    expect(controller.getState().status).toBe('speaking');

    controller.stop();
    expect(controller.getState().status).toBe('idle');

    unsubscribe();
  });

  it('cancels playback cleanly on stop', () => {
    controller.speak('نص للقراءة');
    expect(controller.getState().status).toBe('speaking');
    controller.stop();
    expect(controller.getState().status).toBe('idle');
  });

  it('notifies listeners on state changes', () => {
    const listener = vi.fn();
    const unsub = controller.subscribe(listener);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'idle' })
    );

    controller.speak('اختبار القراءة للمريض');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'speaking' })
    );

    unsub();
  });
});

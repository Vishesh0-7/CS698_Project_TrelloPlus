import { describe, expect, it } from 'vitest';
import {
  createWebSocketBoardUpdateHandler,
  handleWebSocketBoardMessage,
  type BoardState,
  type CardMoveEvent,
} from './useWebSocketBoardUpdates';

describe('handleWebSocketBoardMessage', () => {
  const initialBoardState: BoardState = {
    stages: [
      {
        id: 'stage-123',
        cards: [
          {
            id: 'card-1',
            title: 'Implement auth flow',
            description: 'Set up login with token refresh',
          },
        ],
      },
      {
        id: 'stage-456',
        cards: [],
      },
    ],
  };

  it('moves a card to toStageId on CARD_MOVED event without throwing', () => {
    const movedPayload: CardMoveEvent = {
      type: 'CARD_MOVED',
      cardData: {
        id: 'card-1',
        title: 'Implement auth flow',
        description: 'Set up login with token refresh',
      },
      toStageId: 'stage-456',
    };

    expect(() =>
      handleWebSocketBoardMessage(initialBoardState, JSON.stringify(movedPayload))
    ).not.toThrow();

    const nextState = handleWebSocketBoardMessage(
      initialBoardState,
      JSON.stringify(movedPayload)
    );

    const originalStage = nextState.stages.find((stage) => stage.id === 'stage-123');
    const targetStage = nextState.stages.find((stage) => stage.id === 'stage-456');

    expect(originalStage).toBeDefined();
    expect(targetStage).toBeDefined();

    expect(originalStage?.cards.some((card) => card.id === 'card-1')).toBe(false);
    expect(targetStage?.cards.some((card) => card.id === 'card-1')).toBe(true);
  });

  it('throws when CARD_MOVED payload omits toStageId', () => {
    const invalidPayload = {
      type: 'CARD_MOVED',
      cardData: {
        id: 'card-1',
        title: 'Implement auth flow',
      },
    };

    expect(() =>
      handleWebSocketBoardMessage(initialBoardState, JSON.stringify(invalidPayload))
    ).toThrow(/toStageId/i);
  });

  it('returns current state for unsupported websocket event types', () => {
    const unknownEvent = JSON.stringify({ type: 'CARD_CREATED', cardData: { id: 'card-2' } });
    const nextState = handleWebSocketBoardMessage(initialBoardState, unknownEvent);

    expect(nextState).toBe(initialBoardState);
  });

  it('throws when CARD_MOVED targets a non-existent stage', () => {
    const movedPayload: CardMoveEvent = {
      type: 'CARD_MOVED',
      cardData: {
        id: 'card-1',
        title: 'Implement auth flow',
      },
      toStageId: 'missing-stage',
    };

    expect(() =>
      handleWebSocketBoardMessage(initialBoardState, JSON.stringify(movedPayload))
    ).toThrow(/Target stage not found/i);
  });

  it('keeps the previous state when websocket message is invalid JSON', () => {
    let state = initialBoardState;
    const updateBoardState = (updater: (previous: BoardState) => BoardState) => {
      state = updater(state);
    };
    const onWebSocketMessage = createWebSocketBoardUpdateHandler(updateBoardState);

    // Root cause: parseMessage() does not guard JSON.parse, so malformed payloads crash the update path.
    expect(() => onWebSocketMessage('{invalid-json')).not.toThrow();
    expect(state).toBe(initialBoardState);
  });
});

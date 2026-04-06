export interface WebSocketCard {
  id: string;
  title: string;
  [key: string]: unknown;
}

export interface BoardStage {
  id: string;
  cards: WebSocketCard[];
}

export interface BoardState {
  stages: BoardStage[];
}

export interface CardMoveEvent {
  type: 'CARD_MOVED';
  cardData: WebSocketCard;
  toStageId: string;
}

export type BoardSocketEvent = CardMoveEvent | { type: string; [key: string]: unknown };
export type BoardStateUpdater = (updater: (previous: BoardState) => BoardState) => void;

interface MessageLike {
  data: string;
}

function parseMessage(message: string | MessageLike): BoardSocketEvent | null {
  const raw = typeof message === 'string' ? message : message.data;
  try {
    return JSON.parse(raw) as BoardSocketEvent;
  } catch {
    return null;
  }
}

export function applyCardMovedEvent(state: BoardState, event: CardMoveEvent): BoardState {
  if (!event.toStageId) {
    throw new Error('CARD_MOVED event is missing toStageId');
  }

  const sourceStage = state.stages.find((stage) =>
    stage.cards.some((card) => card.id === event.cardData.id)
  );
  const targetStage = state.stages.find((stage) => stage.id === event.toStageId);

  if (!targetStage) {
    throw new Error(`Target stage not found: ${event.toStageId}`);
  }

  if (!sourceStage) {
    throw new Error(`Card not found in any stage: ${event.cardData.id}`);
  }

  return {
    stages: state.stages.map((stage) => {
      if (stage.id === sourceStage.id) {
        return {
          ...stage,
          cards: stage.cards.filter((card) => card.id !== event.cardData.id),
        };
      }

      if (stage.id === targetStage.id) {
        return {
          ...stage,
          cards: [...stage.cards.filter((card) => card.id !== event.cardData.id), event.cardData],
        };
      }

      return stage;
    }),
  };
}

export function handleWebSocketBoardMessage(
  state: BoardState,
  message: string | MessageLike
): BoardState {
  const event = parseMessage(message);

  if (!event || typeof event.type !== 'string') {
    return state;
  }

  if (event.type === 'CARD_MOVED') {
    return applyCardMovedEvent(state, event as CardMoveEvent);
  }

  return state;
}

export function createWebSocketBoardUpdateHandler(updateBoardState: BoardStateUpdater) {
  return (message: string | MessageLike): void => {
    updateBoardState((previous) => handleWebSocketBoardMessage(previous, message));
  };
}

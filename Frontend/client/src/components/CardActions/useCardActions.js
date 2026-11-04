import { createContext, useContext } from 'react';
export const CardActionsContext = createContext(null);
export function useCardActions() {
  const context = useContext(CardActionsContext);
  if (!context) throw new Error('Card actions must be used inside ContentActionsProvider.');
  return context;
}

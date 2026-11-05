import { createContext, useContext } from 'react';

const PageActivityContext = createContext(true);

export function PageActivityProvider({ active, children }) {
  return <PageActivityContext.Provider value={active}>{children}</PageActivityContext.Provider>;
}

// Consumers also work on uncached pages, where they are active by default.
// eslint-disable-next-line react-refresh/only-export-components
export function usePageActive() { return useContext(PageActivityContext); }

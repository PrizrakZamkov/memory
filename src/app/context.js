import { createContext, useContext } from 'react';

// Everything the screens need: data, vault, navigation helpers and dialogs.
export const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

import { createContext, useContext } from 'react';
export const StoryCommentsContext = createContext(null);
export function useStoryComments() { return useContext(StoryCommentsContext); }

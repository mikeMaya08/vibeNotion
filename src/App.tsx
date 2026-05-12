import React from 'react';
import { Editor } from './components/Editor';

const App: React.FC = () => {
  return (
    <div className="app" data-testid="app">
      <Editor />
    </div>
  );
};

export default App;

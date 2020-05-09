import React from 'react';
import './App.css';
import { MyEditor } from './Editor';
import { stateToMarkdown } from "draft-js-export-markdown";
import { stateFromMarkdown } from "draft-js-import-markdown";

const initialText = `# Headline 1

Hello

* World
* Second
* Third

OK`

function App() {
  const [value, setValue] = React.useState(stateFromMarkdown(initialText))
  return (
    <div className="App">
      <div className="App-header">
        <MyEditor value={value} onChange={value => {
          console.log(stateToMarkdown(value, {
            gfm: true
          }))
          console.log(value.toJS())
          setValue(value)
        }} />
      </div>
    </div>
  );
}

export default App;

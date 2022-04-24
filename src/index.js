import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import './index.css';
// import App from './App';
import App from './Home';
// import reportWebVitals from './reportWebVitals';
// import * as serviceWorker from './serviceWorker';

const root = ReactDOMClient.createRoot(document.getElementById('root'));

root.render(
    <App />,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// serviceWorker.unregister();

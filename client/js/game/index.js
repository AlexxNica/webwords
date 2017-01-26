/**
*
* Copyright 2016 Google Inc. All rights reserved.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import {h, render} from 'preact';

import dependenciesReady from '../js-common/load-dependencies';
import GameStorage from '../js-common/models/game';
import Game from '../../../shared/game';
import Root from './root';
import {put as putState, get as getState} from './initial-state';

dependenciesReady.then(async () => {
  let initialState = window.initialState;
  let stateStale = !initialState;

  if (initialState) {
    // Upgrade game to object
    if (initialState.game) {
      initialState.game = new Game(new GameStorage(initialState.game));
    }
    
    putState(initialState);
  }
  else {
    initialState = await getState();
  }

  const main = document.querySelector('.main-content');
  const root = main.firstElementChild;
  render(
    <Root initialState={initialState} stateStale={stateStale}/>,
    main, root
  );
});
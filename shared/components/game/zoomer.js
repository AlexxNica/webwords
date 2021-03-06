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
import {h} from 'preact';
import {mat2d, vec2} from 'gl-matrix';

import BoundComponent from '../utils/bound-component';

function getTouchDistance(t1, t2) {
  const xDist = Math.abs(t1.pageX - t2.pageX);
  const yDist = Math.abs(t1.pageY - t2.pageY);

  return Math.sqrt(xDist*xDist + yDist*yDist);
}

export default class Zoomer extends BoundComponent {
  constructor(props) {
    super(props);
    this.outerEl = null;
    this.innerEl = null;
    this.innerMinScale = 1;
    this.innerScale = 1;
    this.innerTranslateX = 0;
    this.innerTranslateY = 0;
    this.innerNaturalWidth = 0;
    this.innerNaturalHeight = 0;
    this.pinching = false;
    
    // Start of pinch
    this.activeTouchIds = [];
    this.startPinchX = 0;
    this.startPinchY = 0;
    this.startPinchDistance = 0;
    
    // During pinch
    this.endPinchDistance = 0;
  }
  onTouchStart(event) {
    // Bail if it's normal scrolling, or we're already pinching
    if (event.touches.length < 2 || this.pinching) return;
    event.preventDefault();

    this.pinching = true;
    this.activeTouchIds = [...event.touches].map(t => t.identifier);
    this.startPinchX = (event.touches[0].pageX + event.touches[1].pageX) / 2;
    this.startPinchY = (event.touches[0].pageY + event.touches[1].pageY) / 2;
    this.startPinchDistance = getTouchDistance(event.touches[0], event.touches[1]);
    
    // Remove regular scrolling
    this.innerTranslateX -= this.outerEl.scrollLeft;
    this.innerTranslateY -= this.outerEl.scrollTop;
    this.outerEl.style.overflow = 'hidden';
    this.outerEl.scrollLeft = 0;
    this.outerEl.scrollTop = 0;

    this.updateInnerPosition();
    
    window.addEventListener('touchmove', this.onTouchMove);
    window.addEventListener('touchend', this.onTouchEnd);
  }
  // I'm so sorry about the contents of this function.
  // I don't really know what I'm doing.
  onTouchMove(event) {
    const outerBounds = this.outerEl.getBoundingClientRect();

    const avgX = (event.touches[0].pageX + event.touches[1].pageX) / 2;
    const avgY = (event.touches[0].pageY + event.touches[1].pageY) / 2;
    const distance = getTouchDistance(event.touches[0], event.touches[1]);
    const distanceDiff = distance / this.startPinchDistance;
    // apply a minimum scale
    const scaleAmount = Math.max(distanceDiff, this.innerMinScale / this.innerScale);

    this.endPinchDistance = distance;

    const matrix = mat2d.create();

    mat2d.translate(matrix, matrix, vec2.fromValues(avgX, avgY));
    mat2d.scale(matrix, matrix, vec2.fromValues(scaleAmount, scaleAmount));
    mat2d.translate(matrix, matrix, vec2.fromValues(-this.startPinchX, -this.startPinchY));
    mat2d.translate(matrix, matrix, vec2.fromValues(this.innerTranslateX, this.innerTranslateY));
    mat2d.scale(matrix, matrix, vec2.fromValues(this.innerScale, this.innerScale));

    const topLeft = vec2.create();
    const bottomRight = vec2.fromValues(this.innerNaturalWidth, this.innerNaturalHeight);

    vec2.transformMat2d(topLeft, topLeft, matrix);
    vec2.transformMat2d(bottomRight, bottomRight, matrix);

    const newWidth = bottomRight[0] - topLeft[0];
    const newHeight = bottomRight[1] - topLeft[1];

    let xTranslate = 0;
    let yTranslate = 0;

    // Are we translating out of the boundaries? If so, fix it up.
    if (newWidth < outerBounds.width) {
      xTranslate = -topLeft[0] + (outerBounds.width - newWidth) / 2;
    }
    else if (topLeft[0] > 0) {
      xTranslate = -topLeft[0];
    }
    else if (bottomRight[0] < outerBounds.width) {
      xTranslate = outerBounds.width - bottomRight[0];
    }

    if (newHeight < outerBounds.height) {
      yTranslate = -topLeft[1] + (outerBounds.height - newHeight) / 2;
    }
    else if (topLeft[1] > 0) {
      yTranslate = -topLeft[1];
    }
    else if (bottomRight[1] < outerBounds.height) {
      yTranslate = outerBounds.height - bottomRight[1];
    }

    // I want to apply this translation as if it were the first operation in the matrix.
    // This seems to do the trick, but there must be an easier way:
    const translate = vec2.fromValues(-xTranslate, -yTranslate);
    mat2d.invert(matrix, matrix);
    mat2d.translate(matrix, matrix, translate);
    mat2d.invert(matrix, matrix);

    this.innerEl.style.transform = `matrix(${matrix[0]}, ${matrix[1]}, ${matrix[2]}, ${matrix[3]}, ${matrix[4]}, ${matrix[5]})`;
  }
  onTouchEnd(event) {
    // Bail if we've still got the original two touches
    if (
      event.touches.length >= 2 &&
      this.activeTouchIds[0] == event.touches.identifier[0] &&
      this.activeTouchIds[1] == event.touches.identifier[1]
    ) return;

    this.pinching = false;
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);

    // Adjust transform and scrolling so whole element can be scrolled to
    const outerBounds = this.outerEl.getBoundingClientRect();
    const innerBounds = this.innerEl.getBoundingClientRect();
    const yOffset = innerBounds.top - outerBounds.top;
    const xOffset = innerBounds.left - outerBounds.left;

    this.innerScale = Math.max(this.innerScale * (this.endPinchDistance / this.startPinchDistance), this.innerMinScale);
    this.innerTranslateX = Math.max(xOffset, 0);
    this.innerTranslateY = Math.max(yOffset, 0);

    this.updateInnerPosition();

    this.outerEl.style.overflow = '';
    this.outerEl.scrollTop -= yOffset;
    this.outerEl.scrollLeft -= xOffset;
  }
  onResize() {
    this.zoomToBounds();
  }
  updateInnerPosition() {
    this.innerEl.style.transform = 
      `translate(${this.innerTranslateX}px, ${this.innerTranslateY}px) ` +
      `scale(${this.innerScale})`;
  }
  zoomToBounds() {
    const outerBounds = this.outerEl.getBoundingClientRect();
    const innerBounds = this.innerEl.getBoundingClientRect();
    const innerUnscaledWidth = innerBounds.width / this.innerScale;
    const innerUnscaledHeight = innerBounds.height / this.innerScale;
    const scaleAmount = Math.min(
      outerBounds.width / innerUnscaledWidth,
      outerBounds.height / innerUnscaledHeight
    );
    const translateX = (outerBounds.width - (innerUnscaledWidth * scaleAmount)) / 2;
    const translateY = (outerBounds.height - (innerUnscaledHeight * scaleAmount)) / 2;

    this.innerScale = scaleAmount;
    this.innerMinScale = scaleAmount;
    this.innerTranslateX = translateX;
    this.innerTranslateY = translateY;

    this.updateInnerPosition();
  }
  componentDidMount() {
    const innerBounds = this.innerEl.getBoundingClientRect();

    this.innerNaturalWidth = innerBounds.width;
    this.innerNaturalHeight = innerBounds.height;
    
    window.addEventListener('resize', this.onResize);
    this.zoomToBounds();
  }
  componentDidUnmount() {
    window.removeEventListener('resize', this.onResize);
  }
  render({children}) {
    return (
      <div ref={el => this.outerEl = el} class="zoomer" onTouchStart={this.onTouchStart}>
        <div ref={el => this.innerEl = el} class="zoomer-inner">
          {children}
        </div>
      </div>
    );
  }
}

/*
 * scrollify
 * https://github.com/apathetic/scrollify
 *
 * Copyright (c) 2016 Wes Hatch
 * Licensed under the MIT license.
 *
 */


/**
 * Feature detection: CSS transforms
 * @type {Boolean}
 */
var transform = false;
const transforms = ['transform', 'webkitTransform', 'MozTransform', 'OTransform', 'msTransform'];
for (let i in transforms) {
	if ( document.body.style[transforms[i]] !== undefined) {
		transform = transforms[i];
		break;
	}
}


/**
 * A list of some default "transformations" that may be applied
 * NOTE: don't use arrow fn's here as they proxy "this"
 * @type {Object}
 */
var effectList = {

	/**
	 * Parallax an element. Options include parallax speed OR parallax range
	 */
	parallax(opts) {
		let offset = 0;

		if (opts.speed !== undefined) {                 // check speed first
			offset = this.absolute * opts.speed;
		} else {                                        // fallback to range
			offset = this.percent * (opts.range || 0);    // default is "0", no effect
		}

		this.el.style[transform] = 'translate(0, '+ offset +'px)';
	},


	/**
	 * Pin an element for a specific duration
	 * ... while this works, it is pretty ugly and candidate for improvement
	 */
	// pin(opts) {
	//  let waypoints = Object.keys(opts);
	//  let percent = this.percent * 100;

	//  waypoints.forEach(where => {
	//    if (percent < parseInt(where)) {

	//      let distance = opts[where];
	//      let absolute = this.absolute;
	//      var current;

	//      if (this.current) {
	//        current = this.current;
	//      } else {
	//        current = absolute;
	//        this.current = current;
	//      }

	//      let end = current + distance; // (this assumes current will be "frozen" and unchanged while pinned)
	//      let offset = absolute - current;

	//      if (absolute < end) {
	//        this.el.style[transform] = 'translate(0, '+ offset +'px)';
	//      }
	//    } else {
	//      // this.el.style[transform] = 'translate(0, 0)';
	//    }
	//  });
	// },



	/**
	 * Toggle a class on or off
	 */
	toggle(opts) {
		let classes = Object.keys(opts);
		let el = this.el;
		let percent = this.percent * 100;

		classes.forEach(function(css) {
			let when = parseInt(opts[css]);
			if (percent > when) {
				el.classList.add(css);
			} else {
				el.classList.remove(css);
			}
		});
	}
}


/**
 * The Scrollify Class
 */
export default class Scrollify {

	/**
	 * params: any TWO of: start / stop / duration.
	 *         start: a percentage of the viewport (eg. 0.5) OR a reference element's position (eg ['#toggle', 0.3] )
	 *         stop: a percentage of the viewport OR a reference element's position
	 *         duration: the duration in pixels
	 *
	 *         default is 0 - 100% (making duration the window height + element height)
	 *
	 *         examples:
	 *          { start: 0, stop: 0.5 }
	 *          { start: 0.1, duration: '400px' }
	 *          { duration: 100px, stop: 1.0 }
	 *          { start: ['#toggle', 0.3], stop: ['#toggle', 0.5] }
	 *          { start: ['#toggle', 0.3], duration: '300px' }
	 *
	 *         easing...? start, to, from, duration
	 *
	 */
	constructor(element, scene={}) {
		let elements = (element instanceof HTMLElement) ? [element] : document.querySelectorAll(element);

		if ( !elements.length || !transform ) { return false; }

		this.ticking = false;
		this.scroll = window.scrollY;
		this.effects = [];
		this.elements = Array.from(elements).map((el) => ({ el: el, percent: 0, absolute: 0 }));

		this.initialize();

		window.addEventListener('scroll', (e) => this.onScroll(e));
		window.addEventListener('resize', (e) => this.onResize(e));
	}

	/**
	 * Initialize the "data" Object for each element, which contains position information as well
	 * as a reference to the DOM node. The calculatation needs to be made "as if from an initial
	 * scroll position of 0".
	 * @return {void}
	 */
	initialize() {
		this.elements.map((data) => {
			let BCR = data.el.getBoundingClientRect();  // TODO use offsetTop

			data.initial = {
				top:  BCR.top + window.scrollY,
				bottom: BCR.bottom + window.scrollY,
				height: BCR.height
			};

			// scene:
			let start, duration;
			if (duration && !start) { start = (end * window.innerHeight - duration) / window.innerHeight; }
			if (start && Array.isArray(start)) {
				BCR = document.querySelector(start[0]).getBoundingClientRect().top; // TODO use offsetTop
				start = start[1]
			}

			//
			data.start = (start * window.innerHeight) + BCR.top + window.scrollY;
			data.duration = duration ? duration : (stop-start) * window.innerHeight;
			//

			this.calculate(data);
			return data;
		});
	}

	/**
	 *
	 */
	addEffect(name, effect) {
		effectList[name] = effect;
		return this;
	}

	/**
	 *
	 */
	useEffect(name, options) {
		let curry = (fn, options) => {
			return function() {       // NOTE: don't use => function here as we do NOT want to bind "this"
        fn.call(this, options); // eslint-disable-line
			}
		}

		this.effects.push( curry(effectList[name], options) );
		return this;
	}

	/**
	 *
	 */
	onScroll() {
		if (!this.ticking) {
			this.ticking = true;
			window.requestAnimationFrame(this.update.bind(this));
			this.scroll = window.scrollY;
		}
	}

	/**
	 *
	 */
	onResize() {
		// this.initialize();
		this.update();
	}

	/**
	 *
	 */
	update() {
		Array.from(this.elements, (data) => this.calculate(data) );
		this.ticking = false;
	}

	/**
	 *
	 */
	calculate(data) {
		let height = window.innerHeight;
		let start = data.initial.top - this.scroll;
		// let end = data.initial.bottom - this.scroll;
		let h = data.initial.height;
		let percent;

		// dont do nuthin until this here thing is within range (ie. top edge peeks out from the bottom of the screen)
		// if (height < start || 0 > end) { return; }   // note: this wont work as the position of each element changes at different rates.

		if (height < data.el.getBoundingClientRect().top || 0 > data.el.getBoundingClientRect().bottom) { return; } // use *actual* position data

		// Calculate how far across the screen the element is. "1" is when the top edge of the element first peeks out
		// from the bottom of the viewport, and "0" is when the bottom edge disappears beyond the top of the viewport:
		// percent = Math.min(1, start / height);     // 1 --> 0
		percent = (start+h) / (height+h);         // 1 --> 0

		// update data Object
		data.percent = percent;           // [TODO] should this be 0 -> 100 ...?
		data.absolute = height - start;

																// start      to  from  end
		// let easing = easeInOutQuad(data.start, 100, 0, data.start+data.duration);

		// cycle through any registered transformations
		this.effects.forEach((effect) => { effect.call(data) });
	}
}

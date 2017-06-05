(function($) {

	//TODO unit test some how

	const EVENT_TYPES = {
		INITIALIZED: "initialized",
		// BEFORE_COPY: "before-copy",
		// AFTER_COPY: "after-copy"
		//TODO Add before and afters for most of the general actions that occur
	};

	window.LiveTemplater = {EVENT_TYPES: EVENT_TYPES};

	let HtmlVariable = function (parsedVariable, variableName, variable, value, type) {
		this.parsedVariable = parsedVariable;
		this.variableName = variableName;
		this.variable = variable;
		this.value = value;
		this.type = type;
	};

	function replaceCSSVar(variable, htmlVar, html) {
		return html.replace(variable, `var(${htmlVar.variable})`);
	}

	function replaceTextVar(variable, htmlVar, html) {
		return html.replace(variable, `<span class="live-templater-${htmlVar.type}-var" id="${htmlVar.variable}">${htmlVar.value}</span>`);
	}

	//TODO defer this to later I think, then we can capture the a tag involved and do crazzzy stuff
	function replaceHrefVar(variable, htmlVar, html) {
		return html/*.replace(variable, `${htmlVar.value}`)*/;
	}

	function replaceVariableValues(variable, htmlVar, html) {
		switch (htmlVar.type)
		{
			case 'text':
			case 'textarea':
				return replaceTextVar(variable, htmlVar, html);
			case 'href':
				return replaceHrefVar(variable, htmlVar, html);
			default:
				return replaceCSSVar(variable, htmlVar, html);
		}
	}

	function processHtmlForVars(html) {
		const varRegx = /\${[^{,}]+}/g,
			vars = html.match(varRegx);

		let htmlVarArr = [],
			htmlVars = {};

		for(let idx = 0; idx < vars.length; idx ++) {
			let variable = vars[idx],
				varProps = variable.replace('${','').replace('}','').split('|'),
				newVar = varProps[0],
				defaultVal = varProps[1],
				varType = varProps[2],
				htmlObj = {};

			let htmlVar = new HtmlVariable(variable, newVar, '--' + newVar, defaultVal, varType);
			html = replaceVariableValues(variable, htmlVar, html);

			if(htmlVars[newVar] == undefined) {
				// if (varType !== 'string') {
					htmlVarArr.push(htmlVar);
				// }
				//TODO remove completely?

				htmlObj[newVar] = htmlVar;
				htmlVars = $.extend(true, htmlObj, htmlVars);
			}
		}

		return {
			newHtml: html,
			htmlVarArr: htmlVarArr,
			htmlVars: htmlVars
		};
	}

	$.fn.liveTemplater = function (options) {
		let finalOpts = $.extend(true, {
			includeCopyBtn: false
		}, options);

		let $this = $(this);

		return this.each(function() {
			new LiveTemplater($this, finalOpts);
		});
	};

	let LiveTemplater = function($target, options) {
		let opts = options,
			$container = $target,
			processedHtml,
			htmlVarArr,
			htmlVars,
			liveTemplater = this;

		function setupVariables() {
			const results = processHtmlForVars(opts.rawHtml);

			processedHtml = results.newHtml;
			htmlVarArr = results.htmlVarArr;
			htmlVars = results.htmlVars;
		}

		function getColorInput(htmlVar, options, isColorInput = true) {
			return `<input type="${isColorInput ? 'color' : 'text'}" name="${htmlVar.variableName}" id="${options.id}-${htmlVar.variableName}" value="${htmlVar.value}" />`;
		}

		function getTextInput(htmlVar, options) {
			return 	`<input type="text" name="${htmlVar.variableName}" id="${options.id}-${htmlVar.variableName}" value="${htmlVar.value}" />`;
		}

		function getTextAreaInput(htmlVar, options) {
			return 	`<textarea name="${htmlVar.variableName}" id="${options.id}-${htmlVar.variableName}">${htmlVar.value}</textarea>`;
		}

		function getVariableInputHtml(htmlVar, options) {
			switch (htmlVar.type) {
				case 'color':
					return getColorInput(htmlVar, options);
				case 'color-text':
					return getColorInput(htmlVar, options, false);
				case 'text':
					return getTextInput(htmlVar, options);
				case 'textarea':
					return getTextAreaInput(htmlVar, options);
				case 'href':
					return getTextInput(htmlVar, options);
			}
		}

		function getCSSVariableStyle(htmlVar) {
			return `${htmlVar.variable}: ${htmlVar.value};`;
		}

		function getVariablesHtml(htmlVarArr, options) {
			let varsHtml = '',
				stylesHtml = '';

			for(let idx = 0; idx < htmlVarArr.length; idx ++) {
				let htmlVar = htmlVarArr[idx];
				varsHtml = varsHtml + `<div class="template-variable ${htmlVar.type}"><label for="${options.id}-${htmlVar.variableName}">${htmlVar.variableName}</label>${getVariableInputHtml(htmlVar, options)}</div>`;
				stylesHtml = stylesHtml + getCSSVariableStyle(htmlVar);
			}

			return {
				varsHtml: varsHtml,
				stylesHtml: stylesHtml
			}
		}

		 function getTemplateActions(options) {
			let actions = '';

			if(options.includeCopyBtn) {
				actions = actions + `<button class="template-btn template-copy-html-btn">Copy HTML</button>`;
			}

			return actions;
		}

		function getTemplateHtml(processedHtml, htmlVarArr, options) {
			const variablesHtml = getVariablesHtml(htmlVarArr, options);

			return `<div class="templater-container" id="${options.id}">
					<div class="templater-top-container">
						<div class="template-name">${options.displayName !== undefined ? options.displayName : options.id}</div>
						<div class="template-actions">${getTemplateActions(options)}</div>
					</div>
					<div class="templater-preview-container">
						<div class="template-variables">${variablesHtml.varsHtml}</div>
						<div class="live-template-preview-container">
							<style>#${options.id} { ${variablesHtml.stylesHtml} }</style>
							<div class="live-template-preview">${processedHtml}</div>
						</div>
					</div>
				</div>`;
		}

		function buildTemplateUI($container, processedHtml, htmlVarArr, options) {
			$container.append(getTemplateHtml(processedHtml, htmlVarArr, options));
		}

		function evaluateHrefVariable($html, htmlVar) {
			$html.find(`a.${opts.id}${htmlVar.variable}`).each((idx, el) => {
				$(el).removeClass(`${opts.id}${htmlVar.variable}`);

				if(!el.classList.length) {
					el.removeAttribute('class');
				}
			});
		}

		function evaluateHrefVariables($html, htmlVars) {
			for(let htmlVarKey of Object.keys(htmlVars)) {
				evaluateHrefVariable($html, htmlVars[htmlVarKey])
			}
		}

		function getEvaluatedTemplateHtml($html, htmlVars) {
			//Remove text var wrappers
			let $textAreaVars = $html.find('.live-templater-textarea-var');

			for(let idx = 0; idx < $textAreaVars.length; idx ++) {
				let $this = $($textAreaVars.get(idx)),
					$parent = $this.parent(),
					innerVal = $this.text();

				$this.remove();
				$parent.text(innerVal);
			}

			evaluateHrefVariables($html, htmlVars);

			let html = $html.html();

			for(let htmlVarKey of Object.keys(htmlVars)) {
				let htmlVar = htmlVars[htmlVarKey];

				if (htmlVar.type === 'href') {
					//Do nothing for hrefs
				} else if(htmlVar.type !== 'text' || htmlVar.type !== 'textarea') {
					html = html.split(`var(${htmlVar.variable})`).join(htmlVar.value);
				}
			}

			return html;
		}

		function copyLiveTemplateToClipboard($container, htmlVars) {
			let txtAr = document.createElement('TEXTAREA');
			txtAr.value = getEvaluatedTemplateHtml($container, htmlVars);
			txtAr.readOnly= true;

			let $txtAr = $(txtAr).appendTo($container).css('height', 0).css('width', 0).css('overflow', 'hidden');
			txtAr.select();
			let success = document.execCommand('copy');

			$txtAr.remove();

			if(success) {
				alert("Copied to clipboard!");
			} else {
				alert("Failed to copy to clipboard!");
			}
		}

		function attachEvents() {
			let $templaterContainer = $(`#${opts.id}`),
				$variables = $templaterContainer.find('.template-variable'),
				$templateActions = $templaterContainer.find('.template-actions'),
				templaterCont = $templaterContainer.get(0),
				hVars = htmlVars;

			//TODO make the htmlvar do the html updating?
			$variables.filter(':not(.text, .href)').on('change', 'input', function (evt) {
				let $input = $(this),
					val = $input.val(),
					htmlVar = hVars[$input.attr('name')];

				htmlVar.value = val;
				templaterCont.style.setProperty(htmlVar.variable, val);
			}).on('keyup', 'textarea', function (evt) {
				let $textArea = $(this),
					val = $textArea.val(),
					htmlVar = hVars[$textArea.attr('name')];

				htmlVar.value = val;
				$templaterContainer.find(`#${htmlVar.variable}`).text(val);
			});

			$variables.filter('.text').on('keyup change', 'input', function (evt) {
				let $input = $(this),
					val = $input.val(),
					htmlVar = hVars[$input.attr('name')];

				htmlVar.value = val;
				$templaterContainer.find(`#${htmlVar.variable}`).text(val);
			});

			$variables.filter('.href').on('keyup change', 'input', function (evt) {
				let $input = $(this),
					val = $input.val(),
					htmlVar = hVars[$input.attr('name')];

				htmlVar.value = val;
				$templaterContainer.find(`a.${opts.id}${htmlVar.variable}`).attr('href', val);
			});

			if(opts.includeCopyBtn) {
				$templateActions.on('click', '.template-copy-html-btn', function (evt) {
					copyLiveTemplateToClipboard($templaterContainer.find('.live-template-preview'), hVars);
				});
			}
		}

		function processBuiltTemplateUI($container, htmlVarArr, opts) {
			let $previewer = $container.find('.live-template-preview');

			htmlVarArr.filter((hVar) => {
				return hVar.type === 'href';
			}).forEach((htmlVar) => {
				$previewer.find(`a[href="${htmlVar.parsedVariable}"]`).each((idx, el) => {
					let $el = $(el).attr('href', htmlVar.value);

					$el.addClass(`${opts.id}${htmlVar.variable}`);
				});
			});
		}

		function removeTemplateUI() {
			$container.empty();
		}

		function setupUI() {
			removeTemplateUI();
			buildTemplateUI($container, processedHtml, htmlVarArr, opts);
			processBuiltTemplateUI($container, htmlVarArr, opts);
			attachEvents();
		}

		function triggerEvent(eventType) {
			$container.trigger(eventType, liveTemplater);
		}

		this.triggerEvent = function(eventType) {
			triggerEvent(eventType);
		};

		function init() {
			setupVariables();
			setupUI();
			triggerEvent(EVENT_TYPES.INITIALIZED);
		}

		init();
	};

} (jQuery));
(function($) {

	//TODO unit test some how

	const EVENT_TYPES = {
		INITIALIZED: "initialized",
		// BEFORE_COPY: "before-copy",
		// AFTER_COPY: "after-copy"
		//TODO Add before and afters for most of the general actions that occur
	};

	window.LiveTemplater = {EVENT_TYPES: EVENT_TYPES};

	class HtmlVariable {
		constructor (parsedVariable, variableName, variable, value, type, enabled = true) {
			this.parsedVariable = parsedVariable;
			this.variableName = variableName;
			this.variable = variable;
			this.value = value;
			this.type = type;
			this.enabled = enabled;
		}
	}

	function replaceCSSVar(variable, htmlVar, html) {
		return html.replace(variable, `var(${htmlVar.variable})`);
	}

	function replaceTextVar(variable, htmlVar, html) {
		return html.replace(variable, `<span class="live-templater-${htmlVar.type}-var" id="${htmlVar.variable}">${htmlVar.value}</span>`);
	}

	function replaceVariableValues(variable, htmlVar, html) {
		switch (htmlVar.type) {
			case 'text':
			case 'textarea':
				return replaceTextVar(variable, htmlVar, html);
			case 'href':
				return html;
			default:
				return replaceCSSVar(variable, htmlVar, html);
		}
	}

	function processHtmlForVars(html, options) {
		const varRegx = /\${[^{,}]+}/g,
			vars = html.match(varRegx);

		let htmlVarArr = [],
			htmlVars = {};

		for (let idx = 0; idx < vars.length; idx++) {
			let variable = vars[idx],
				varProps = variable.replace('${', '').replace('}', '').split('|'),
				newVar = varProps[0],
				defaultVal = varProps[1],
				varType = varProps[2],
				htmlObj = {};

			let htmlVar = '';
			if(varType === 'href') {
				htmlVar = new HtmlVariable(variable, newVar, '--' + newVar, defaultVal, varType, options.enableLinksByDefault);
			} else {
				htmlVar = new HtmlVariable(variable, newVar, '--' + newVar, defaultVal, varType);
			}
			html = replaceVariableValues(variable, htmlVar, html);

			if (htmlVars[newVar] == undefined) {
				htmlVarArr.push(htmlVar);

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
			includeCopyBtn: true,
			copyBtnLabel: 'Copy HTML',
			includeResetBtn: true,
			resetBtnLabel: 'Reset',
			enableLinksByDefault: true
		}, options);

		let $this = $(this);

		return this.each(function () {
			new LiveTemplater($this, finalOpts);
		});
	};

	let LiveTemplater = function ($target, options) {
		let opts = options,
			$container = $target,
			processedHtml,
			htmlVarArr,
			htmlVars,
			liveTemplater = this;

		function getVariableValue(htmlVar, val) {
			switch (htmlVar.type) {
				case "font-size":
					return val + 'px';
				default:
					return val;
			}
		}

		function setupVariables() {
			const results = processHtmlForVars(opts.rawHtml, opts);

			processedHtml = results.newHtml;
			htmlVarArr = results.htmlVarArr;
			htmlVars = results.htmlVars;
		}

		function getColorInput(htmlVar, options, isColorInput = true) {
			return `<input type="${isColorInput ? 'color' : 'text'}" name="${htmlVar.variableName}" id="${options.id}-${htmlVar.variableName}" value="${htmlVar.value}" />`;
		}

		function getTextInput(htmlVar, options) {
			return `<input type="text" name="${htmlVar.variableName}" id="${options.id}-${htmlVar.variableName}" value="${htmlVar.value}" />`;
		}

		function getNumberInput(htmlVar, options) {
			return `<input type="number" name="${htmlVar.variableName}" id="${options.id}-${htmlVar.variableName}" value="${htmlVar.value}" />`;
		}

		function getFontSizeInput(htmlVar, options) {
			//TODO allow for size type selections (ex: em, px)
			return `<input type="number" name="${htmlVar.variableName}" id="${options.id}-${htmlVar.variableName}" value="${htmlVar.value}" /><span class="font-size-unit-label">px</span>`;
		}

		function getTextAreaInput(htmlVar, options) {
			return `<textarea name="${htmlVar.variableName}" id="${options.id}-${htmlVar.variableName}">${htmlVar.value}</textarea>`;
		}

		function getHrefInput(htmlVar, options) {
			return `<input type="text" name="${htmlVar.variableName}" id="${options.id}-${htmlVar.variableName}" value="${htmlVar.value}" ${!options.enableLinksByDefault ? 'disabled="disabled"' : ""} /><label class="template-variable-toggle" for="${options.id}-${htmlVar.variableName}--toggle" >enable link</label><input id="${options.id}-${htmlVar.variableName}--toggle" name="${htmlVar.variableName}--toggle" value="${htmlVar.variableName}" type="checkbox" ${options.enableLinksByDefault ? 'checked="checked"' : ""} name/>`;
		}

		function getVariableInputHtml(htmlVar, options) {
			switch (htmlVar.type) {
				case 'color':
					return getColorInput(htmlVar, options);
				case 'color-text':
					return getColorInput(htmlVar, options, false);
				case 'textarea':
					return getTextAreaInput(htmlVar, options);
				case 'number':
					return getNumberInput(htmlVar, options);
				case 'font-size':
					return getFontSizeInput(htmlVar, options);
				case 'href':
					return getHrefInput(htmlVar, options);
				default :
					return getTextInput(htmlVar, options);
			}
		}

		function getCSSVariableStyle(htmlVar) {
			return `${htmlVar.variable}: ${getVariableValue(htmlVar, htmlVar.value)};`;
		}

		function getVariablesHtml(htmlVarArr, options) {
			let varsHtml = '',
				stylesHtml = '';

			for (let idx = 0; idx < htmlVarArr.length; idx++) {
				let htmlVar = htmlVarArr[idx];
				varsHtml = varsHtml + `<div class="template-variable ${htmlVar.type}"><label for="${options.id}-${htmlVar.variableName}">${htmlVar.variableName}</label>${getVariableInputHtml(htmlVar, options)}</div>`;
				stylesHtml = stylesHtml + getCSSVariableStyle(htmlVar);
			}

			return {
				varsHtml: varsHtml,
				stylesHtml: stylesHtml
			}
		}

		function getCopyBtn() {
			return `<button class="template-btn template-copy-html-btn">${opts.copyBtnLabel}</button>`;
		}

		function getResetBtn() {
			return `<button class="template-btn template-reset-btn">${opts.resetBtnLabel}</button>`;
		}

		function getTemplateActions(options) {
			let actions = '';

			//TODO turn into enum'esk list and loop through ones given to build instead of stupid if statements
			if (options.includeCopyBtn) {
				actions = actions + getCopyBtn();
			}

			if (options.includeResetBtn) {
				actions = actions + getResetBtn();
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

				if (!el.classList.length) {
					el.removeAttribute('class');
				}

				if (!htmlVar.enabled) {
					$(el).attr('templater-html-disabled', htmlVar.variable);
				}
			});
		}

		function evaluateHrefVariables($html, htmlVars) {
			for (let htmlVarKey of Object.keys(htmlVars)) {
				evaluateHrefVariable($html, htmlVars[htmlVarKey])
			}
		}

		//TODO maybe instead of replacing it, it could just remove it entirely? or at least give the option to do that
		function replaceDisabledHref(el) {
			return new Promise(resolve => {
				let innerHtml = el.innerHTML,
					classNames = el.className,
					id = el.id,
					styles = el.style.cssText;

				$(el).replaceWith(`<span class="${classNames}" id="${id}" style="${styles}">${innerHtml}</span>`);
				resolve();
			});
		}

		async function replaceDisabledHrefs(hVar, html) {
			let $html = $(html),
				$disabled = $html.find(`a[templater-html-disabled="${hVar.variable}"]`);
			for(let idx = 0; idx < $disabled.length; idx ++) {
				await replaceDisabledHref($disabled.get(idx));
			}

			return $html.get(0).outerHTML;
		}

		async function evaluatedDisabled(htmlVars, html) {
			//TODO make more generic so that it eventually handles other disabled things inside of it. So work from inside out.
			let disabledVars = Object.values(htmlVars).filter((hVar) => {
				return hVar.type === 'href' && !hVar.enabled;
			});

			for(let disabledVar of disabledVars) {
				html = await replaceDisabledHrefs(disabledVar, html);
			}

			return html;
		}

		async function getEvaluatedTemplateHtml($html, htmlVars) {
			//Remove text var wrappers
			let $textAreaVars = $html.find('.live-templater-textarea-var, .live-templater-text-var');

			for (let idx = 0; idx < $textAreaVars.length; idx++) {
				let $this = $($textAreaVars.get(idx)),
					$parent = $this.parent(),
					innerVal = $this.text();

				$this.remove();
				$parent.text(innerVal);
			}

			evaluateHrefVariables($html, htmlVars);

			let html = $html.get(0).outerHTML;

			for (let htmlVarKey of Object.keys(htmlVars)) {
				let htmlVar = htmlVars[htmlVarKey];

				if (htmlVar.type === 'href') {
					//Do nothing for hrefs
				}
				if (htmlVar.type === 'background-image') {
					html = html.split(`var(${htmlVar.variable})`).join(`url('${htmlVar.value}')`);
				} else if(htmlVar.type === 'font-size') {
					html = html.split(`var(${htmlVar.variable})`).join(htmlVar.value + 'px');
				} else if (htmlVar.type !== 'text' && htmlVar.type !== 'textarea') {
					html = html.split(`var(${htmlVar.variable})`).join(htmlVar.value);
				}
			}

			return await evaluatedDisabled(htmlVars, html);
		}

		async function copyLiveTemplateToClipboard($container, htmlVars) {
			let txtAr = document.createElement('TEXTAREA'),
				$containerClone = $container.clone();
			txtAr.value = await getEvaluatedTemplateHtml($containerClone, htmlVars);
			txtAr.readOnly = true;

			let $txtAr = $(txtAr).appendTo($container).css('height', 0).css('width', 0).css('overflow', 'hidden');
			txtAr.select();
			let success = document.execCommand('copy');

			$txtAr.remove();

			return success;
		}

		function attachEvents() {
			let $templaterContainer = $(`#${opts.id}`),
				$variables = $templaterContainer.find('.template-variable'),
				$templateActions = $templaterContainer.find('.template-actions'),
				templaterCont = $templaterContainer.get(0),
				hVars = htmlVars;

			//TODO make the htmlvar do the html updating?
			$variables.filter(':not(.text, .href, .background-image)').on('change', 'input', function (evt) {
				let $input = $(this),
					val = $input.val(),
					htmlVar = hVars[$input.attr('name')];

				htmlVar.value = val;
				val = getVariableValue(htmlVar, val);
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

			$variables.filter('.href').on('keyup change', 'input[type="text"]', function (evt) {
				let $input = $(this),
					val = $input.val(),
					htmlVar = hVars[$input.attr('name')];

				htmlVar.value = val;
				$templaterContainer.find(`a.${opts.id}${htmlVar.variable}`).attr('href', val);
			}).on('change', 'input[type="checkbox"]', function (evt) {
				let $input = $(this),
					$hrefInput = $input.parent().find('input[type="text"]'),
					val = $input.val(),
					htmlVar = hVars[val],
					isChecked = $input.is(':checked');

				htmlVar.enabled = isChecked;

				if(isChecked) {
					$hrefInput.removeAttr('disabled');
				} else {
					$hrefInput.attr('disabled', 'disabled');
				}
			});

			$variables.filter('.background-image').on('keyup change', 'input', function (evt) {
				let $input = $(this),
					val = $input.val(),
					htmlVar = hVars[$input.attr('name')];

				htmlVar.value = val;
				templaterCont.style.setProperty(htmlVar.variable, `url("${val}")`);
			});

			if (opts.includeCopyBtn) {
				$templateActions.on('click', '.template-copy-html-btn', function (evt) {
					copyLiveTemplateToClipboard($templaterContainer.find('.live-template-preview'), hVars).then((success) => {
						if (success) {
							alert("Copied to clipboard!");
						} else {
							alert("Failed to copy to clipboard!");
						}
					});
				});
			}

			if (opts.includeResetBtn) {
				$templateActions.on('click', '.template-reset-btn', function (evt) {
					init();
				});
			}
		}

		function processBuiltTemplateUI($container, htmlVarArr, opts) {
			let $previewer = $container.find('.live-template-preview');

			htmlVarArr.filter((hVar) => {
				return hVar.type === 'href';
			}).forEach((htmlVar) => {
				htmlVar.targetHtml = $previewer.find(`a[href="${htmlVar.parsedVariable}"]`);
				htmlVar.targetHtml.each((idx, el) => {
					let $el = $(el).attr('href', htmlVar.value);

					$el.addClass(`${opts.id}${htmlVar.variable}`);
				});
			});

			let $templaterCont = $(`#${opts.id}`),
				templaterCont = $templaterCont.get(0);

			htmlVarArr.filter((hVar) => {
				return hVar.type === 'background-image';
			}).forEach((htmlVar) => {
				$previewer.find(`#${opts.id}-${htmlVar.name} input`);
				templaterCont.style.setProperty(htmlVar.variable, `url("${htmlVar.value}")`);
			});

			//TODO we should save the referenced html element here so that we can manipulate it at will
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

		this.triggerEvent = function (eventType) {
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
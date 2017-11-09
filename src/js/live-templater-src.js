(function($) {

	//TODO unit test some how

	const EVENT_TYPES = {
		INITIALIZED: "initialized",
		// BEFORE_COPY: "before-copy",
		// AFTER_COPY: "after-copy"
		AFTER_CHANGE: "after-change"
		//TODO Add before and afters for most of the general actions that occur
	};

	const MESSAGE_TYPES = {
		ERROR: "error",
		WARNING: "warning"
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
			this.attributeName = null;
		}
	}

	function replaceCSSVar(variable, htmlVar, html) {
		return html.replace(variable, `var(${htmlVar.variable})`);
	}

	function replaceTextVar(variable, htmlVar, html) {
		return html.replace(variable, `<span class="live-templater-${htmlVar.type}-var" id="${htmlVar.variable}">${htmlVar.value}</span>`);
	}

	function replaceAttributeText(variable, htmlVar, html) {
		let varStart = html.indexOf(variable),
			varEnd = varStart + variable.length,
			preVar = html.substring(0, varStart),
			postVar = html.substring(varEnd, varEnd + 1),
			restAfterVar = html.substring(varEnd + 1, html.length);

		return `${preVar}${htmlVar.value}${postVar} data-templater-attr-${htmlVar.attributeName}="${htmlVar.variableName}" ${restAfterVar}`;
	}

	function replaceVariableValues(variable, htmlVar, html) {
		switch (htmlVar.type) {
			case 'text':
			case 'textarea':
				return replaceTextVar(variable, htmlVar, html);
			case 'href':
				return html;
			case 'attr-text':
				return replaceAttributeText(variable, htmlVar, html);
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

			let htmlVar = {};

			if(varType === 'href') {
				htmlVar = new HtmlVariable(variable, newVar, '--' + newVar, defaultVal, varType, options.enableLinksByDefault);
			} else {
				htmlVar = new HtmlVariable(variable, newVar, '--' + newVar, defaultVal, varType);
			}

			if(varProps.length > 3) {
				htmlVar.attributeName = varProps[3];
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
			enableLinksByDefault: true,
			allowLineBreaks: true,
			maxWidthWarning: {
				message: "The max width has been exceeded"
			}
		}, options);

		let $this = $(this);

		return this.each(function () {
			new LiveTemplater($this, finalOpts);
		});
	};

	let LiveTemplater = function ($target, options) {
		let opts = options,
			$container = $target,
			messages = {
				[MESSAGE_TYPES.ERROR]: [],
				[MESSAGE_TYPES.WARNING]: []
			},
			processedHtml,
			htmlVarArr,
			htmlVars,
			liveTemplater = this;

		function getMessageHtml(messageType, message) {
			return `<div class="templater-message templater-message-${messageType} ${message.id}" data-message-id="${message.id}"><span class="templater-message-${messageType}-icon"></span>${message.message}</div>`;
		}

		function renderMessagesForType(messageType, $messageContainer) {
			let messageIds = [];

			for(let message of messages[messageType]) {
				if(!$messageContainer.find(`.${message.id}`).length) {
					$messageContainer.append(getMessageHtml(messageType, message));
				}

				messageIds.push(message.id);
			}

			return messageIds;
		}

		function renderAllMessages() {
			let $messageContainer = $container.find('.templater-message-container'),
				messageIds = [];

			//Render errors first
			messageIds = messageIds.concat(renderMessagesForType(MESSAGE_TYPES.ERROR, $messageContainer));
			//Render warnings next
			messageIds = messageIds.concat(renderMessagesForType(MESSAGE_TYPES.WARNING, $messageContainer));

			let $allMessages = $messageContainer.find('.templater-message');

			if(messageIds.length !== $allMessages.length) {
				$allMessages.each((idx, message) => {
					let $message = $(message),
						messageId = $message.data('message-id');

					if(messageIds.indexOf(messageId) < 0) {
						$message.remove();
					}
				});
			}
		}

		function showMessage(eventType, id, message) {
			if(messages[eventType].every((message) => {return message.id !== id})) {
				messages[eventType].push({id: id, message: message});
				renderAllMessages();
			}
		}

		function removeMessage(eventType, id) {
			let removeIdx = -1;

			messages[eventType].forEach((message, idx) => {
				if(message.id === id) {
					removeIdx = idx;
				}
			});

			if(removeIdx >= 0) {
				messages[eventType].splice(removeIdx, 1);
				renderAllMessages();
			}
		}

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

		function getMaxWidthContainer(maxWidth) {
			return `<div class="templater-max-width-container">
						<div class="templater-max-width-left-cover" style="right: calc(100% - ((100% - ${maxWidth}px) / 2));"></div>
						<div class="templater-max-width-indicator" style="width:${maxWidth}px;"></div>
						<div class="templater-max-width-right-cover" style="left: calc(100% - ((100% - ${maxWidth}px) / 2));"></div>
					</div>`;
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
							<div class="templater-preview-right-column">
								<div class="templater-message-container"></div>
								<div class="live-template-preview-container">
									<style>#${options.id} { ${variablesHtml.stylesHtml} }</style>
									<div class="live-template-preview">${processedHtml}</div>
								</div>
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
					//Allows us to grab the line breaks
					innerVal = $this.html();

				$this.remove();
				//Allows us to pass along those line breaks
				$parent.html(innerVal);
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
				} else if(htmlVar.type === 'attr-text') {
					html = html.replace(`data-templater-attr-${htmlVar.attributeName}="${htmlVar.variableName}"`, '');
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
			$variables.filter(':not(.text, .href, .background-image, .attr-text)').on('change', 'input', function (evt) {
				let $input = $(this),
					val = $input.val(),
					htmlVar = hVars[$input.attr('name')];

				htmlVar.value = val;
				val = getVariableValue(htmlVar, val);
				templaterCont.style.setProperty(htmlVar.variable, val);
				triggerEvent(EVENT_TYPES.AFTER_CHANGE);
			}).on('keyup', 'textarea', function (evt) {
				let $textArea = $(this),
					val = $textArea.val(),
					htmlVar = hVars[$textArea.attr('name')];

				if(opts.allowLineBreaks) {
					htmlVar.value = val.replace(/\n/g, '<br/>');
				} else {
					htmlVar.value = val;
				}

				$templaterContainer.find(`#${htmlVar.variable}`).html(htmlVar.value);
				triggerEvent(EVENT_TYPES.AFTER_CHANGE);
			});

			$variables.filter('.attr-text').on('keyup change', 'input', function (evt) {
				let $input = $(this),
					val = $input.val(),
					htmlVar = hVars[$input.attr('name')];

				htmlVar.value = val;
				$templaterContainer.find(`*[data-templater-attr-${htmlVar.attributeName}="${htmlVar.variableName}"]`).attr(htmlVar.attributeName, val);
				triggerEvent(EVENT_TYPES.AFTER_CHANGE);
			});

			$variables.filter('.text').on('keyup change', 'input', function (evt) {
				let $input = $(this),
					val = $input.val(),
					htmlVar = hVars[$input.attr('name')];

				htmlVar.value = val;
				$templaterContainer.find(`#${htmlVar.variable}`).text(val);
				triggerEvent(EVENT_TYPES.AFTER_CHANGE);
			});

			$variables.filter('.href').on('keyup change', 'input[type="text"]', function (evt) {
				let $input = $(this),
					val = $input.val(),
					htmlVar = hVars[$input.attr('name')];

				htmlVar.value = val;
				$templaterContainer.find(`a.${opts.id}${htmlVar.variable}`).attr('href', val);
				triggerEvent(EVENT_TYPES.AFTER_CHANGE);
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

				triggerEvent(EVENT_TYPES.AFTER_CHANGE);
			});

			$variables.filter('.background-image').on('keyup change', 'input', function (evt) {
				let $input = $(this),
					val = $input.val(),
					htmlVar = hVars[$input.attr('name')];

				htmlVar.value = val;
				templaterCont.style.setProperty(htmlVar.variable, `url("${val}")`);
				triggerEvent(EVENT_TYPES.AFTER_CHANGE);
			});

			if(!!opts.maxWidthWarning.maxWidth && opts.maxWidthWarning.maxWidth > 0) {
				let maxWidth = opts.maxWidthWarning.maxWidth,
					widthWarningMessageId = "max-width-warning";

				$(getMaxWidthContainer(maxWidth)).appendTo($templaterContainer.find('.live-template-preview-container'));

				$container.on(`${EVENT_TYPES.AFTER_CHANGE} ${EVENT_TYPES.INITIALIZED}`, function() {
					let $previewContainer = $templaterContainer.find('.live-template-preview-container'),
						$preview = $templaterContainer.find('.live-template-preview'),
						width = $preview.width();

					if(width > maxWidth) {
						$previewContainer.addClass('width-limit-exceeded');
						showMessage(MESSAGE_TYPES.WARNING, widthWarningMessageId, opts.maxWidthWarning.message);
					} else {
						$previewContainer.removeClass('width-limit-exceeded');
						removeMessage(MESSAGE_TYPES.WARNING, widthWarningMessageId)
					}
				});
			}

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
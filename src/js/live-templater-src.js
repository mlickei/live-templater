(function($) {

	let HtmlVariable = function (variableName, variable, value, type) {
		this.variableName = variableName;
		this.variable = variable;
		this.value = value;
		this.type = type;
	};

	function replaceCSSVar(variable, htmlVar, html) {
		return html.replace(variable, `var(${htmlVar.variable})`);
	}

	function replaceTextVar(variable, htmlVar, html) {
		return html.replace(variable, `<span class="live-templater-text-var" id="${htmlVar.variable}">${htmlVar.value}</span>`);
	}

	function replaceVariableValues(variable, htmlVar, html) {
		switch (htmlVar.type)
		{
			case 'text':
				return replaceTextVar(variable, htmlVar, html);
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

			let htmlVar = new HtmlVariable(newVar, '--' + newVar, defaultVal, varType);
			html = replaceVariableValues(variable, htmlVar, html);

			if(htmlVars[newVar] == undefined) {
				if (varType !== 'string') {
					htmlVarArr.push(htmlVar);
				}

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

		return this.each(function() {
			(new LiveTemplater($(this), finalOpts)).init();
		});
	};

	let LiveTemplater = function($target, options) {
		this.options = options;
		this.$target = $target;
	};

	LiveTemplater.prototype.setupVariables = function() {
		const results = processHtmlForVars(this.options.rawHtml);

		this.processedHtml = results.newHtml;
		this.htmlVarArr = results.htmlVarArr;
		this.htmlVars = results.htmlVars;
	};

	LiveTemplater.prototype.getColorInput = function(htmlVar) {
		return `<input type="color" name="${htmlVar.variableName}" id="${this.options.id}-${htmlVar.variableName}" value="${htmlVar.value}" />`;
	};

	LiveTemplater.prototype.getTextInput = function (htmlVar) {
		return 	`<textarea name="${htmlVar.variableName}" id="${this.options.id}-${htmlVar.variableName}">${htmlVar.value}</textarea>`;
	};

	LiveTemplater.prototype.getVariableInputHtml = function(htmlVar) {
		switch (htmlVar.type) {
			case 'color':
				return this.getColorInput(htmlVar);
			case 'text':
				return this.getTextInput(htmlVar);
		}
	};

	LiveTemplater.prototype.getCSSVariableStyle = function(htmlVar) {
		return `${htmlVar.variable}: ${htmlVar.value};`;
	};

	LiveTemplater.prototype.getVariablesHtml = function() {
		let varsHtml = '',
			stylesHtml = '';

		for(let idx = 0; idx < this.htmlVarArr.length; idx ++) {
			let htmlVar = this.htmlVarArr[idx];
			varsHtml = varsHtml + `<div class="template-variable"><label for="${this.options.id}-${htmlVar.variableName}">${htmlVar.variableName}</label>${this.getVariableInputHtml(htmlVar)}</div>`;
			stylesHtml = stylesHtml + this.getCSSVariableStyle(htmlVar);
		}

		return {
			varsHtml: varsHtml,
			stylesHtml: stylesHtml
		}
	};

	LiveTemplater.prototype.getTemplateActions = function() {
		let actions = '';

		if(this.options.includeCopyBtn) {
			actions = actions + `<button class="template-btn template-copy-html-btn">Copy HTML</button>`;
		}

		return actions;
	};

	LiveTemplater.prototype.getTemplateHtml = function() {
		const variablesHtml = this.getVariablesHtml();

		return `<div class="templater-container" id="${this.options.id}">
					<div class="templater-top-container">
						<div class="template-name">${this.options.id}</div>
						<div class="template-actions">${this.getTemplateActions()}</div>
					</div>
					<div class="templater-preview-container">
						<div class="template-variables">${variablesHtml.varsHtml}</div>
						<div class="live-template-preview-container">
							<style>#${this.options.id} { ${variablesHtml.stylesHtml} }</style>
							<div class="live-template-preview">${this.processedHtml}</div>
						</div>
					</div>
				</div>`;
	};

	LiveTemplater.prototype.buildTemplateUI = function() {
		this.$target.append(this.getTemplateHtml());
	};

	function getEvaluatedTemplateHtml($html, htmlVars) {
		//Remove text var wrappers
		let $textVars = $html.find('.live-templater-text-var')

		for(let idx = 0; idx < $textVars.length; idx ++) {
			let $this = $($textVars.get(idx)),
				$parent = $this.parent(),
				innerVal = $this.text();

			$this.remove();
			$parent.text(innerVal);
		}

		let html = $html.html();

		for(let htmlVarKey of Object.keys(htmlVars)) {
			let htmlVar = htmlVars[htmlVarKey];

			if(htmlVar.type != 'text') {
				html = html.split(`var(${htmlVar.variable})`).join(htmlVar.value);
			}
		}

		return html;
	}

	function copyLiveTemplateToClipboard($target, htmlVars) {
		let txtAr = document.createElement('TEXTAREA');
		txtAr.value = getEvaluatedTemplateHtml($target, htmlVars);
		txtAr.readOnly= true;

		let $txtAr = $(txtAr).appendTo($target).css('height', 0).css('width', 0).css('overflow', 'hidden');
		txtAr.select();
		let success = document.execCommand('copy');

		$txtAr.remove();

		if(success) {
			alert("Copied to clipboard!");
		} else {
			alert("Failed to copy to clipboard!");
		}
	}

	LiveTemplater.prototype.attachEvents = function () {
		let $templaterContainer = $(`#${this.options.id}`),
			$variables = $templaterContainer.find('.template-variable'),
			$templateActions = $templaterContainer.find('.template-actions'),
			templaterCont = $templaterContainer.get(0),
			htmlVars = this.htmlVars;

		$variables.on('change', 'input', function (evt) {
			let $input = $(this),
				val = $input.val(),
				htmlVar = htmlVars[$input.attr('name')];

			htmlVar.value = val;
			templaterCont.style.setProperty(htmlVar.variable, val);
		}).on('keyup', 'textarea', function (evt) {
			let $textArea = $(this),
				val = $textArea.val(),
				htmlVar = htmlVars[$textArea.attr('name')];

			htmlVar.value = val;
			$templaterContainer.find(`#${htmlVar.variable}`).text(val);
		});

		if(this.options.includeCopyBtn) {
			$templateActions.on('click', '.template-copy-html-btn', function (evt) {
				copyLiveTemplateToClipboard($templaterContainer.find('.live-template-preview'), htmlVars);
			});
		}
	};

	LiveTemplater.prototype.removeTemplateUI = function() {
		this.$target.empty();
	};

	LiveTemplater.prototype.setupUI = function () {
		this.removeTemplateUI();
		this.buildTemplateUI();
		this.attachEvents();
	};

	LiveTemplater.prototype.init = function() {
		this.setupVariables();
		this.setupUI();
	};

} (jQuery));
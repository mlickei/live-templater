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
		return html.replace(variable, `<span id="${htmlVar.variable}">${htmlVar.value}</span>`);
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

			if(varType !== 'string') {
				htmlVarArr.push(htmlVar);
			}

			html = replaceVariableValues(variable, htmlVar, html);

			htmlObj[newVar] = htmlVar;
			htmlVars = $.extend(true, htmlObj, htmlVars);
		}

		return {
			newHtml: html,
			htmlVarArr: htmlVarArr,
			htmlVars: htmlVars
		};
	}

	$.fn.liveTemplater = function (options) {
		let finalOpts = $.extend(true, {

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

	LiveTemplater.prototype.getTemplateHtml = function() {
		const variablesHtml = this.getVariablesHtml();

		return `<div class="templater-container" id="${this.options.id}">
					<div class="template-variables">${variablesHtml.varsHtml}</div>
					<div class="live-template-preview-container">
						<style>#${this.options.id} { ${variablesHtml.stylesHtml} }</style>
						<div class="live-template-preview">${this.processedHtml}</div>
					</div>
				</div>`;
	};

	LiveTemplater.prototype.buildTemplateUI = function() {
		this.$target.append(this.getTemplateHtml());
	};

	LiveTemplater.prototype.attachEvents = function () {
		let $templaterContainer = $(`#${this.options.id}`),
			templaterCont = $templaterContainer.get(0),
			$variables = $templaterContainer.find('.template-variable'),
			htmlVars = this.htmlVars;

		$variables.on('change', 'input', function (evt) {
			let $input = $(this),
				val = $input.val(),
				htmlVar = htmlVars[$input.attr('name')];

			templaterCont.style.setProperty(htmlVar.variable, val);
		}).on('change', 'textarea', function (evt) {
			let $textArea = $(this),
				val = $textArea.val(),
				htmlVar = htmlVars[$textArea.attr('name')];

			$templaterContainer.find(`#${htmlVar.variable}`).text(val);
		});
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
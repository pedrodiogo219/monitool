/*!
 * This file is part of Monitool.
 *
 * Monitool is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Monitool is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Monitool. If not, see <http://www.gnu.org/licenses/>.
 */

import angular from 'angular';

import uiDatepickerPopup from 'angular-ui-bootstrap/src/datepickerPopup/index';

const module = angular.module(
	'monitool.components.form.utcdatepicker',
	[
		uiDatepickerPopup
	]
);


/**
 * Init datepicker modules
 */
module.config(function(uibDatepickerConfig, uibDatepickerPopupConfig) {
	uibDatepickerConfig.showWeeks = false;
	uibDatepickerConfig.startingDay = 1;
	uibDatepickerPopupConfig.showButtonBar = false;
});


// Work around bug in angular ui datepicker
// https://github.com/angular-ui/bootstrap/issues/6140
module.directive('utcDatepicker', function() {
	return {
		restrict: 'E',
		require: 'ngModel',
		template: require('./utc-datepicker.html'),
		scope: {},
		link: function(scope, element, attributes, ngModelController) {

			ngModelController.$formatters.push(function(modelValue) {
				modelValue = new Date(modelValue + 'T00:00:00Z');
				modelValue = new Date(modelValue.getTime() + modelValue.getTimezoneOffset() * 60 * 1000);
				return modelValue;
			});

			ngModelController.$parsers.push(function(viewValue) {
				viewValue = new Date(viewValue.getTime() - viewValue.getTimezoneOffset() * 60 * 1000);
				viewValue = viewValue.toISOString().substring(0, 10);
				return viewValue;
			});

			ngModelController.$render = function() {
				scope.localDate = ngModelController.$viewValue;
			};

			scope.$watch('localDate', function(localDate) {
				ngModelController.$setViewValue(localDate);
			});
		}
	}
});

export default module;

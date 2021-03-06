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
	'monitool.components.ng-models.datepicker-optional',
	[
		uiDatepickerPopup
	]
);


module.component('optionalDate', {
	require: {
		ngModelCtrl: 'ngModel'
	},

	template: require('./datepicker-optional.html'),

	bindings: {
		default: '<',
		message: '@'
	},

	controller: class OptionalDateController {

		$onInit() {
			this.ngModelCtrl.$render = () => {
				this.specifyDate = this.ngModelCtrl.$viewValue !== null;
				this.chosenDate = this.ngModelCtrl.$viewValue;
			};
		}

		toggleSpecifyDate() {
			this.specifyDate = !this.specifyDate;
			if (this.specifyDate)
				this.chosenDate = this.default;

			this.onDateChange();
		}

		onDateChange() {
			this.ngModelCtrl.$setViewValue(this.specifyDate ? this.chosenDate : null);
		}
	}
});


export default module.name;
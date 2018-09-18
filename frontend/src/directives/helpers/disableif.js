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


const module = angular.module(
	'monitool.directives.helpers.disableif',
	[]
);


module.directive('disableIf', function() {

	var inhibitHandler = function(event) {
		event.stopImmediatePropagation();
		event.preventDefault();
		return false;
	};

	return {
		retrict: 'A',
		priority: 100,
		scope: {
			disableIf: "="
		},
		link: function($scope, domElement, attributes) {
			$scope.$watch('disableIf', function(disable) {
				if (disable) {
					domElement.addClass('disabled')
					domElement.on('click', inhibitHandler);

					if (domElement.hasClass('clickable')) {
						domElement.removeClass('clickable');
						domElement.addClass('nonclickable');
					}
				}
				else {
					domElement.removeClass('disabled')
					domElement.off('click', inhibitHandler);

					if (domElement.hasClass('nonclickable')) {
						domElement.addClass('clickable');
						domElement.removeClass('nonclickable');
					}
				}
			});
		}
	}
});

export default module.name;

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
import uiRouter from '@uirouter/angularjs';


const module = angular.module(
	'monitool.components.pages.project.input.menu',
	[
		uiRouter // for $stateProvider
	]
);


module.config($stateProvider => {

	$stateProvider.state('main.project.input', {
		abstract: true,
		component: 'projectInputMenu',
	});

});


module.component('projectInputMenu', {

	bindings: {
		project: '<'
	},

	template: require('./menu.html'),

	controller: class ProjectInputMenuController {

		constructor($state, $stateParams) {
			this.$state = $state;
			this.$stateParams = $stateParams;
		}
	}
});


export default module.name;


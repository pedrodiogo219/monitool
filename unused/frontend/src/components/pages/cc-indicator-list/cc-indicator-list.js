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

import Indicator from '../../../models/indicator';
import Theme from '../../../models/theme';


const module = angular.module(
	'monitool.components.pages.indicator.list',
	[
		uiRouter, // for $stateProvider
	]
);

module.config($stateProvider => {

	if (window.user.type == 'user') {
		$stateProvider.state('main.indicators', {
			url: '/indicators',
			component: 'crossCuttingIndicatorList',
			resolve: {
				indicators: () => Indicator.fetchAll(),
				themes: () => Theme.fetchAll()
			}
		});
	}
});


module.component('crossCuttingIndicatorList', {
	bindings: {
		indicators: '<',
		themes: '<'
	},
	template: require('./cc-indicator-list.html'),

	controller: class CrossCuttingIndicatorList {

		constructor($rootScope) {
			this.$rootScope = $rootScope;
		}

		$onChanges(changes) {
			this.categories = [];

			const noThematicsIndicators = this.indicators.filter(i => i.themes.length == 0);
			if (noThematicsIndicators.length)
				this.categories.push({ definition: null, translate: 'zero_theme_indicator', indicators: noThematicsIndicators });

			// Create a category with indicators that match project on exactly 1 thematic
			// FIXME: The theme sorting won't be updated if the user change the language while using this page.
			this.themes
				.slice()
				.sort((t1, t2) => t1.shortName[this.$rootScope.language].localeCompare(t2.shortName[this.$rootScope.language]))
				.forEach(theme => {
					const themeIndicators = this.indicators.filter(i => i.themes.length === 1 && i.themes[0] === theme._id);
					if (themeIndicators.length !== 0)
						this.categories.push({ definition: theme, indicators: themeIndicators });
				});

			// Create a category with indicators that match project on 2 thematics or more
			const manyThematicsIndicators = this.indicators.filter(i => i.themes.length > 1);
			if (manyThematicsIndicators.length)
				this.categories.push({ definition: null, translate: 'multi_theme_indicator', indicators: manyThematicsIndicators });
		}
	}
});


export default module.name;



import angular from 'angular';

import mtReportingField from './td-reporting-field';
import mtIndicatorUnit from '../../../filters/indicator';
import {fetchData, computeSplitPartitions} from '../../../helpers/indicator';

const module = angular.module(
	'monitool.components.pages.project.reporting.indicator-row',
	[
		mtReportingField.name,
		mtIndicatorUnit.name
	]
);


module.directive('trIndicator', () => {
	return {
		controllerAs: '$ctrl',
		restrict: 'A',
		scope: {}, // Isolate

		bindToController: {
			project: '<',
			columns: '<',
			groupBy: '<',
			filter: '<',
			indicator: '<',
			split: '<',
			firstColStyle: '<',

			onSplitToggle: '&',
			onPlotToggle: '&',
		},

		template: require('./tr-indicator.html'),

		controller: class IndicatorRowController {

			constructor($scope, $timeout) {
				this.$scope = $scope;
				this.$timeout = $timeout;
			}

			$onChanges(changes) {
				const redraw = changes.groupBy ||
					(changes.indicator && !angular.equals(changes.indicator.previousValue, changes.indicator.currentValue)) ||
					(changes.filter && !angular.equals(changes.filter.previousValue, changes.filter.currentValue)) ||
					(changes.columns && !angular.equals(changes.columns.previousValue, changes.columns.currentValue));

				if (redraw && !this._refreshWaiting) {
					this.name = this._computeName();
					this.isGroup = this._computeIsGroup();
					this.availablePartitions = this._computeAvailablePartitions();
					this.values = null;

					this.$timeout(this._fetchData.bind(this), 100);
					this._refreshWaiting = true;
				}
			}

			$onDestroy() {
				if (this.graphToggled)
					this.onPlotToggle({data: null});
			}

			toggleSplit(partitionId) {
				this.onSplitToggle({partitionId: partitionId})
			}

			toggleGraph() {
				if (this.graphToggled)
					this.onPlotToggle({data: null});
				else
					this.onPlotToggle({name: this.name, data: this._data});

				this.graphToggled = !this.graphToggled;
			}

			async _fetchData() {
				this._refreshWaiting = false;
				this.errorMessage = 'shared.loading';
				this.values = null;

				try {
					this._data = await fetchData(
						this.project,
						this.indicator.computation,
						[this.groupBy],
						this.filter,
						true,
						false
					);

					this.errorMessage = null;
					this.values = this.columns.map(col => this._data[col.id]);
					if (this.graphToggled)
						this.onPlotToggle({name: this.name, data: this._data});
				}
				catch (e) {
					this.errorMessage = e.message;
					this.onPlotToggle({data: null});
				}

				this.$scope.$apply();
			}

			_computeName() {
				const lastFilter = Object.keys(this.filter).pop();
				const partition = this.project.forms
					.reduce((m, e) => m.concat(e.elements), [])
					.reduce((m, e) => m.concat(e.partitions), [])
					.find(p => p.id === lastFilter)

				if (partition) {
					const filterValue = this.filter[lastFilter];
					if (filterValue.length === 1) {
						const pe = partition.elements.find(pe => pe.id === filterValue[0]);
						return pe.name;
					}
					else {
						const pg = partition.groups.find(pg => angular.equals(filterValue, pg.members));
						return pg ? pg.name : '??';
					}
				}
				else
					return this.indicator.display;
			}

			_computeIsGroup() {
				const lastFilter = Object.keys(this.filter).pop();
				const partition = this.project.forms
					.reduce((m, e) => m.concat(e.elements), [])
					.reduce((m, e) => m.concat(e.partitions), [])
					.find(p => p.id === lastFilter)

				return partition ? this.filter[lastFilter].length !== 1 : false;
			}

			_computeAvailablePartitions() {
				return computeSplitPartitions(this.project, this.indicator.computation)
					.filter(p => !this.filter[p.id]);
			}
		}
	};
});

export default module;
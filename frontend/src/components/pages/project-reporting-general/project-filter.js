
import mtMselectWithGroups from '../../shared/ng-models/mselect-with-groups';

const module = angular.module(
	'monitool.component.page.project-reporting-general.project-filter',
	[
		mtMselectWithGroups
	]
);


module.component('projectFilter', {
	bindings: {
		project: '<',
		onUpdate: '&'
	},

	template: require('./project-filter.html'),

	controller: class ProjectFilterController {

		$onInit() {
			this.panelOpen = false;
		}

		$onChanges(changes) {
			this.filter = {
				site: this.project.sites.map(e => e.id),
				_start: this.project.start,
				_end: this.project.end,
			};

			this.onFilterChange();
		}

		onFilterChange() {
			const myFilter = angular.copy(this.filter);
			if (myFilter.site.length === this.project.sites.length)
				delete myFilter.site;

			this.onUpdate({filter: myFilter});
		}
	}
});


export default module.name;

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

"use strict";

angular
	.module(
		'monitool.controllers.project.structure',
		[
		]
	)


	/**
	 * Controller used by "main.project.structure" state.
	 *
	 * It handles:
	 * 		- A warning when the user try to change current page without saving changes.
	 *		- Form validation + save & reset" buttons
	 */
	.controller('ProjectEditController', function($scope, $filter, indicators) {
		$scope.editableProject = angular.copy($scope.masterProject);	// Current version of project.
		$scope.projectSaveRunning = false;				// We are not currently saving.
		$scope.forms = {current: undefined};

		// When project changes, update save flags
		var onProjectChange = function() {
			$scope.projectChanged = !angular.equals($scope.masterProject, $scope.editableProject);

			$scope.projectSavable = $scope.projectChanged;
			if ($scope.forms.current)
				$scope.projectSavable = $scope.projectSavable && $scope.forms.current.$valid;
		};

		$scope.$watch('editableProject', onProjectChange, true);
		$scope.$watch('forms.current.$valid', onProjectChange);

		// Restore $scope.master to avoid unsaved changes from a given page to pollute changes to another one.
		// $scope.$on('$stateChangeStart', function(e, toState, toParams, fromState, fromParams) {
		// 	// If project is currently saving, disable all links
		// 	if ($scope.projectSaveRunning) {
		// 		e.preventDefault();
		// 		return;
		// 	}

		// 	// If project is changed, warn user that changes will be lost.
		// 	if ($scope.projectChanged) {
		// 		// then ask the user if he meant it
		// 		if (window.confirm($filter('translate')('shared.sure_to_leave')))
		// 			$scope.reset();
		// 		else
		// 			e.preventDefault();
		// 	}
		// });

		// save, reset and isUnchanged are all defined here, because those are shared between all project views.
		$scope.save = function() {
			// When button is disabled, do not execute action.
			if (!$scope.projectSavable || $scope.projectSaveRunning)
				return;

			$scope.projectSaveRunning = true;
			$scope.editableProject.sanitize(indicators);

			return $scope.editableProject.$save()
				.then(function() {
					angular.copy($scope.editableProject, $scope.masterProject);
					$scope.projectChanged = false;
					$scope.projectSavable = false;
					$scope.projectSaveRunning = false;
					$scope.$broadcast('projectSaved');
				})
				.catch(function(error) {
					// Display message to tell user that it's not possible to save.
					var translate = $filter('translate');
					alert(translate('project.saving_failed'));

					$scope.projectSaveRunning = false;
				});
		};

		$scope.reset = function() {
			// When button is disabled, do not execute action.
			if (!$scope.projectChanged || $scope.projectSaveRunning)
				return;

			// Clone last saved version of project.
			angular.copy($scope.masterProject, $scope.editableProject);
			$scope.$broadcast('projectReset');
		};
	})

	/**
	 * Controller used by the "main.project.structure.basics" state.
	 * Allows to change basic informations.
	 */
	.controller('ProjectBasicsController', function($scope, themes) {
		$scope.themes = themes;
		$scope.startDateOptions = {maxDate: $scope.editableProject.end};
		$scope.endDateOptions = {minDate: $scope.editableProject.start};
	})


	/**
	 * Controller used by the "main.project.structure.collection_site_list" state.
	 * Allows to change entities and groups.
	 */
	.controller('ProjectCollectionSiteListController', function($scope, uuid) {
		$scope.createEntity = function() {
			$scope.editableProject.entities.push({id: uuid.v4(), name: '', start: null, end: null});
		};

		$scope.deleteEntity = function(entityId) {
			$scope.editableProject.entities = $scope.editableProject.entities.filter(function(e) { return e.id !== entityId; });
			$scope.editableProject.sanitize();
		};

		$scope.createGroup = function() {
			$scope.editableProject.groups.push({id: uuid.v4(), name: '', members: []});
		};

		$scope.deleteGroup = function(groupId) {
			$scope.editableProject.groups = $scope.editableProject.groups.filter(function(group) { return group.id !== groupId; });
		};
	})

	/**
	 * Controller used by the "main.project.structure.user_list" state.
	 * Allows to list and reorder users that can access/edit the project.
	 */
	.controller('ProjectUserListController', function($scope, $uibModal, $filter, users) {
		$scope.users = {};

		users.forEach(function(user) { $scope.users[user._id] = user});

		$scope.editUser = function(user) {
			var promise = $uibModal.open({
				controller: 'ProjectUserModalController',
				templateUrl: 'partials/projects/structure/user-modal.html',
				size: 'lg',
				scope: $scope, // give our $scope to give it access to userCtx, project and indicatorsById.
				resolve: { allUsers: function() { return users; }, projectUser: function() { return user; } }
			}).result;

			promise.then(function(newUser) {
				if (user && !newUser) // Delete
					$scope.editableProject.users.splice($scope.editableProject.users.indexOf(user), 1);
				else if (!user && newUser) // Add
					$scope.editableProject.users.push(newUser);
				else if (user && newUser) // Replace
					$scope.editableProject.users.splice($scope.editableProject.users.indexOf(user), 1, newUser);
			});
		};
	})

	/**
	 * Controller used on a modal called from "main.project.structure.user_list"
	 * Allows to edit a user
	 */
	.controller('ProjectUserModalController', function($scope, $uibModalInstance, allUsers, projectUser) {
		// Build the list of users that are available on the select box
		// Available users are user that are not already taken (besides current one).
		$scope.availableUsers = allUsers.filter(function(user) {
			var isTakenInProject = $scope.editableProject.users.find(function(u) { return u.id == user._id; }),
				isTakenByMe      = projectUser && projectUser.id === user._id;

			return isTakenByMe || !isTakenInProject;
		});

		// Build the list of forbidden usernames if creating a partner account.
		$scope.partners = $scope.editableProject.users.filter(function(u) {
			if (projectUser)
				return u.type == 'partner' && u.username !== projectUser.username;
			else
				return u.type == 'partner';
		}).pluck('username');

		// isNew will be used by the view to disable inputs that can't be changed (username, etc), and show delete button.
		$scope.isNew = !projectUser;

		// The form updates a copy of the object, so that user can cancel the changes by just dismissing the modal.
		$scope.user = projectUser ? angular.copy(projectUser) : {type: "internal", id: null, role: "owner", entities: [], dataSources: []};
		if (!$scope.user.entities)
			$scope.user.entities = [];
		if (!$scope.user.dataSources)
			$scope.user.dataSources = [];

		$scope.masterUser = angular.copy($scope.user);

		$scope.isUnchanged = function() {
			return angular.equals($scope.masterUser, $scope.user);
		};

		$scope.reset = function() {
			angular.copy($scope.masterUser, $scope.user);
		}

		$scope.done = function() {
			if ($scope.user.type == 'internal') {
				delete $scope.user.login;
				delete $scope.user.password;
			}
			else
				delete $scope.user.id;

			if ($scope.user.role != 'input') {
				delete $scope.user.entities;
				delete $scope.user.dataSources;
			}

			$uibModalInstance.close($scope.user);
		};

		$scope.delete = function() { $uibModalInstance.close(null); };
		$scope.cancel = function() { $uibModalInstance.dismiss(); };
	})


	/**
	 * Controller used by the "main.project.structure.collection_form_list" state.
	 * Allows to list and reorder data sources.
	 */
	.controller('ProjectCollectionFormListController', function($scope, $state, $filter, uuid) {
		$scope.availableEntities = $scope.masterProject.entities;

		$scope.createForm = function() {
			var newForm = {id: uuid.v4(), name: '', periodicity: 'month', entities: [], start: null, end: null, elements: []};
			$scope.editableProject.forms.push(newForm);
			$state.go('main.project.structure.collection_form_edition', {formId: newForm.id});
		};
	})

	/**
	 * Controller used by the "main.project.structure.collection_form_edit" state.
	 * Allows to edit a data sources.
	 */
	.controller('ProjectCollectionFormEditionController', function($scope, $state, $stateParams, uuid) {
		var setForm = function() {
			$scope.form = $scope.editableProject.forms.find(function(f) { return f.id == $stateParams.formId; });
			if (!$scope.form)
				$state.go('main.project.structure.collection_form_list');
		};

		setForm();
		$scope.$on('projectReset', setForm);

		$scope.deleteForm = function() {
			// Remove the form from the list
			$scope.editableProject.forms.splice(
				$scope.editableProject.forms.indexOf($scope.form),
				1
			);

			// Go back to the list page, where the user will be allowed to save.
			$state.go('main.project.structure.collection_form_list');
		};

		$scope.newVariable = function() {
			var newVariable = {
				id: uuid.v4(), name: "", partitions: [], order: 0, distribution: 0, geoAgg: 'sum', timeAgg: 'sum'
			};

			$scope.form.elements.push(newVariable);
			$state.go('main.project.structure.variable_edition', {formId: $stateParams.formId, variableId: newVariable.id});
		};

		$scope.remove = function(item, target) {
			var index = target.findIndex(function(arrItem) { return item.id === arrItem.id; });
			if (index !== -1)
				target.splice(index, 1)
		};
	})

	.controller('ProjectVariableEditionController', function($scope, $state, $stateParams, $uibModal, uuid) {
		var setVariable = function() {
			$scope.form = $scope.editableProject.forms.find(function(f) { return f.id == $stateParams.formId; });

			if (!$scope.form)
				$state.go('main.project.structure.collection_form_list');
			else {
				$scope.variable = $scope.form.elements.find(function(v) { return v.id == $stateParams.variableId; });
				if (!$scope.variable)
					$state.go('main.project.structure.collection_form_edition', {formId: $stateParams.formId});
			}
		};

		setVariable();
		$scope.$on('projectReset', setVariable);

		$scope.editPartition = function(currentPartition) {
			$uibModal.open({
				controller: 'PartitionEditionModalController',
				templateUrl: 'partials/projects/structure/partition-modal.html',
				size: 'lg',
				resolve: { currentPartition: function() { return currentPartition; } }
			}).result.then(function(updatedPartition) {
				var sizeChanged = false;

				// Partition was deleted
				if (currentPartition && !updatedPartition) {
					$scope.variable.partitions.splice($scope.variable.partitions.indexOf(currentPartition), 1);
					sizeChanged = true;
				}
				// Partition was updated
				else if (currentPartition && updatedPartition)
					$scope.variable.partitions[$scope.variable.partitions.indexOf(currentPartition)] = updatedPartition;
				// Partition was added
				else if (!currentPartition && updatedPartition) {
					sizeChanged = true;
					$scope.variable.partitions.push(updatedPartition);
				}

				if (sizeChanged) {
					$scope.variable.distribution = Math.ceil($scope.variable.partitions.length / 2);
					$scope.variable.order = 0;
				}
			});
		};
	})

	.controller('PartitionEditionModalController', function($scope, $uibModalInstance, $filter, currentPartition, uuid) {
		$scope.isNew = false;
		if (!currentPartition) {
			currentPartition = {
				id: uuid.v4(),
				name: "",
				elements: [{id: uuid.v4(), name: ""}, {id: uuid.v4(), name: ""}],
				groups: [],
				aggregation: "sum"
			}
			$scope.isNew = true;
		}

		$scope.master = currentPartition;
		$scope.partition = angular.copy(currentPartition);
		$scope.useGroups = !!$scope.partition.groups.length;
		$scope.closedOnPurpose = false;

		$scope.$watch('useGroups', function(value) {
			if (!value)
				$scope.partition.groups = [];
		});

		$scope.$watch('partition.elements.length', function(length) {
			$scope.partitionForm.$setValidity('elementLength', length >= 2);
		});

		$scope.isUnchanged = function() {
			return angular.equals($scope.master, $scope.partition);
		};

		$scope.save = function() {
			$scope.closedOnPurpose = true;
			$uibModalInstance.close($scope.partition);
		};

		$scope.reset = function() {
			angular.copy($scope.master, $scope.partition);
			$scope.useGroups = !!$scope.partition.groups.length;
		};

		$scope.createPartitionElement = function() {
			$scope.partition.elements.push({id: uuid.v4(), name: ''});
		};

		$scope.deletePartitionElement = function(partitionElementId) {
			// Remove from element list
			$scope.partition.elements = $scope.partition.elements.filter(function(element) {
				return element.id !== partitionElementId;
			});

			// Remove from all groups
			$scope.partition.groups.forEach(function(group) {
				group.members = group.members.filter(function(member) {
					return member !== partitionElementId;
				});
			});
		};

		$scope.createGroup = function() {
			$scope.partition.groups.push({id: uuid.v4(), name: '', members: []});
		};

		$scope.deleteGroup = function(partitionGroupId) {
			$scope.partition.groups = $scope.partition.groups.filter(function(group) {
				return group.id !== partitionGroupId;
			});
		};

		$scope.delete = function() {
			$scope.closedOnPurpose = true;
			$uibModalInstance.close(null);
		};

		$scope.closeModal = function() {
			$uibModalInstance.dismiss(null);
		};

		$scope.$on('modal.closing', function(event) {
			var hasChanged = !$scope.isUnchanged();
			var closedOnPurpose = $scope.closedOnPurpose;

			if (hasChanged && !closedOnPurpose) {
				var question = $filter('translate')('shared.sure_to_leave');
				var isSure = window.confirm(question);
				if (!isSure)
					event.preventDefault();
			}
		});
	})

	.controller('ProjectLogicalFrameListController', function($scope, $state) {

		$scope.createLogicalFrame = function(logicalFrame) {
			var newLogicalFrame;
			if (!logicalFrame)
				newLogicalFrame = {name: '', goal: '', start: null, end: null, indicators: [], purposes: []};
			else
				newLogicalFrame = angular.copy(logicalFrame);

			$scope.editableProject.logicalFrames.push(newLogicalFrame);
			$state.go('main.project.structure.logical_frame_edition', {index: $scope.editableProject.logicalFrames.length - 1});
		};

	})

	.controller('ProjectLogicalFrameEditController', function($scope, $state, $stateParams, $filter, $timeout, $uibModal) {

		/////////////////////
		// Allow purposes, outputs and indicators reordering. We need to hack around bugs
		// in current Sortable plugin implementation.
		// @see https://github.com/RubaXa/Sortable/issues/581
		// @see https://github.com/RubaXa/Sortable/issues/722
		/////////////////////

		$scope.purposeSortOptions = {group:'purposes', handle: '.purpose-handle'};
		$scope.outputSortOptions = {group:'outputs', handle: '.output-handle'};
		$scope.activitySortOptions = {group:'activities', handle: '.activity-handle'};
		$scope.indicatorsSortOptions = {
			group:'indicators',
			handle: '.indicator-handle',
			onStart: function() { document.body.classList.add('dragging'); },
			onEnd: function() { document.body.classList.remove('dragging'); }
		};

		$scope.onSortableMouseEvent = function(group, enter) {
			if (group == 'outputs')
				$scope.purposeSortOptions.disabled = enter;
			else if (group == 'activities')
				$scope.purposeSortOptions.disabled = $scope.outputSortOptions.disabled = enter;
			else if (group == 'indicators')
				$scope.purposeSortOptions.disabled = $scope.outputSortOptions.disabled = $scope.activitySortOptions = enter;
		};

		$scope.logicalFrameIndex = $stateParams.index;

		/////////////////////
		// Create and remove elements from logical frame
		/////////////////////

		$scope.addPurpose = function() {
			$scope.editableProject.logicalFrames[$scope.logicalFrameIndex].purposes.push({
				description: "", assumptions: "", indicators: [], outputs: []
			});
		};

		$scope.addOutput = function(purpose) {
			purpose.outputs.push({
				description: "", activities: [], assumptions: "", indicators: []
			});
		};

		$scope.addActivity = function(output) {
			output.activities.push({
				description: "", indicators: []
			});
		};

		$scope.remove = function(element, list) {
			list.splice(list.indexOf(element), 1);
		};

		// handle indicator add, edit and remove are handled in a modal window.
		$scope.addIndicator = function(parent) {
			var promise = $uibModal.open({
				controller: 'ProjectIndicatorEditionModalController',
				templateUrl: 'partials/projects/structure/edition-modal.html',
				size: 'lg',
				scope: $scope, // give our $scope to give it access to userCtx, project and indicatorsById.
				resolve: {planning: function() { return null; }, indicator: function() { return null; }}
			}).result;

			promise.then(function(newPlanning) {
				if (newPlanning)
					parent.push(newPlanning);
			});
		};

		var w1 = $scope.$watch('editableProject.logicalFrames[logicalFrameIndex]', function(form) {
			if (!form) {
				w1();
				$state.go('main.project.structure.logical_frame_list');
			}
		});

		$scope.deleteLogicalFrame = function() {
			// Kill the watches
			w1();

			// Remove the form
			$scope.editableProject.logicalFrames.splice($scope.logicalFrameIndex, 1);
			$scope.$parent.save(true).then(function() {
				$state.go('main.project.structure.logical_frame_list');
			});
		};
	})

	.controller('ProjectCrossCuttingController', function($scope, $uibModal, indicators, themes) {
		$scope.themes = [];

		// Create a category with indicators that match project on 2 thematics or more
		var manyThematicsIndicators = indicators.filter(function(indicator) {
			return indicator.themes.length > 1 && indicator.themes.filter(function(themeId) {
				return $scope.masterProject.themes.indexOf(themeId) !== -1;
			}).length > 0;
		});
		if (manyThematicsIndicators.length)
			$scope.themes.push({definition: null, indicators: manyThematicsIndicators});

		// Create a category with indicators that match project on exactly 1 thematic
		themes.forEach(function(theme) {
			if ($scope.masterProject.themes.indexOf(theme._id) !== -1) {
				var themeIndicators = indicators.filter(function(indicator) {
					return indicator.themes.length === 1 && indicator.themes[0] === theme._id;
				});

				if (themeIndicators.length !== 0)
					$scope.themes.push({definition: theme, indicators: themeIndicators});
			}
		});

		// This getter will be used by the orderBy directive to sort indicators in the partial.
		$scope.getName = function(indicator) {
			return indicator.name[$scope.language];
		};

		// Indicator add, edit and remove are handled in a modal window.
		$scope.editIndicator = function(indicatorId) {
			var planning = $scope.editableProject.crossCutting[indicatorId];
			var promise = $uibModal.open({
				controller: 'ProjectIndicatorEditionModalController',
				templateUrl: 'partials/projects/structure/edition-modal.html',
				size: 'lg',
				scope: $scope, // give our $scope to give it access to userCtx, project and indicatorsById.
				resolve: {
					planning: function() { return planning; },
					indicator: function() { return indicators.find(function(i) { return i._id == indicatorId; }); }
				}
			}).result;

			promise.then(function(newPlanning) {
				if (!newPlanning)
					delete $scope.editableProject.crossCutting[indicatorId];
				else
					$scope.editableProject.crossCutting[indicatorId] = newPlanning;
			});
		};
	})

	.controller('ProjectExtraIndicators', function($scope, $uibModal) {
		$scope.addIndicator = function() {
			var promise = $uibModal.open({
				controller: 'ProjectIndicatorEditionModalController',
				templateUrl: 'partials/projects/structure/edition-modal.html',
				size: 'lg',
				scope: $scope, // give our $scope to give it access to userCtx, project and indicatorsById.
				resolve: {planning: function() { return null; }, indicator: function() { return null; }}
			}).result;

			promise.then(function(newPlanning) {
				if (newPlanning)
					$scope.editableProject.extraIndicators.push(newPlanning);
			});
		};
	})


	.controller('ProjectIndicatorEditionModalController', function($scope, $uibModalInstance, planning, indicator) {
		$scope.indicator = indicator;
		$scope.planning = planning ? angular.copy(planning) : {
			display: '',
			colorize: true,
			baseline: null,
			target: null,
			computation: {
				formula: "copied_value",
				parameters: {
					copied_value: {
						elementId: null,
						filter: {}
					}
				}
			}
		};

		if ($scope.indicator)
			delete $scope.planning.display;

		$scope.masterPlanning = angular.copy($scope.planning);
		$scope.isUnchanged = function() {
			return angular.equals($scope.planning, $scope.masterPlanning);
		};

		$scope.reset = function() {
			angular.copy($scope.masterPlanning, $scope.planning);
		};

		$scope.isNew = !planning;

		$scope.save   = function() { $uibModalInstance.close($scope.planning); };
		$scope.delete = function() { $uibModalInstance.close(null); };
		$scope.cancel = function() { $uibModalInstance.dismiss(); };
	})

	.controller('ProjectRevisions', function($scope, Revision) {
		var currentOffset = 0, pageSize = 10;

		$scope.loading = false;
		$scope.revisions = [];

		// Listen to the project reset event to reset selectedIndex.
		$scope.$on('projectReset', function() {
			$scope.selectedIndex = -1;
		});

		// Listen to the project saved event to reload
		$scope.$on('projectSaved', function() {
			currentOffset = 0;
			$scope.selectedIndex = -1;
			$scope.revisions = [];
			$scope.showMore();
		});

		$scope.showMore = function() {
			if ($scope.loading)
				return;

			var params = {projectId: $scope.masterProject._id, offset: currentOffset, limit: pageSize};
			currentOffset = currentOffset + pageSize;
			$scope.loading = true;

			Revision.query(params).$promise.then(function(newRevisions) {
				$scope.loading = false;
				$scope.finished = newRevisions.length < pageSize;
				$scope.revisions = $scope.revisions.concat(newRevisions);
				Revision.enrich($scope.masterProject, $scope.revisions);
			});
		};

		$scope.restore = function(index) {
			$scope.selectedIndex = index;
			angular.copy($scope.revisions[index].before, $scope.editableProject);
		};

		$scope.showMore();
	})


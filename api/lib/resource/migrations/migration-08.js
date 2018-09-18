import database from '../database';


const migrateInputs = async () => {
	// Update projects, and create revisions.
	for (let i = 0; i < 16 * 16; ++i) {
		console.log('input', i, '/', dbResults.rows.length);

		const prefix = i.toString(16).padStart(2, '0');

		const documents = (
			await database.callList({
				startkey: 'input:' + prefix + '!',
				endkey: 'input:' + prefix + '~',
				include_docs: true
			})
		).rows.map(row => row.doc);

		documents.forEach(input => {
			input.projectId = input.project;
			input.dataSourceId = input.form;
			input.siteId = input.entity;

			delete input.project;
			delete input.form;
			delete input.entity;
		});

		await database.callBulk({docs: documents});
	}

};

const updateIndicator = indicator => {
	if (!indicator.computation)
		return;

	Object.values(indicator.computation.parameters).forEach(param => {
		param.variableId = param.elementId;
		delete param.elementId;
	})
};


const migrateProjects = async () => {
	// Update projects, and create revisions.
	const dbResults = await Promise.all([
		database.callList({startkey: 'project:!', endkey: 'project:~'}),
		database.callList({startkey: 'revision:project:!', endkey: 'revision:project:~'})
	]);

	const documents = [
		...dbResults[0].rows.map(row => row.doc),
		...dbResults[1].rows.map(row => row.doc)
	]

	documents.forEach(project => {
		// Rename project.entities to project.sites
		project.sites = project.entities;
		delete project.entities;

		// Rename project.forms to project.dataSources
		project.dataSources = project.forms;
		delete project.forms;

		// Rename items inside dataSources
		project.dataSources.forEach(dataSource => {
			// Rename form.va
			form.variables = form.elements;
			delete form.elements;

			if (form.entities) {
				form.siteIds = form.entities;
				delete form.entities;
			}
		});

		// Rename items inside logicalframes
		project.logicalFrames.forEach(logframe => {
			// Rename logframe.entities to logframe.siteIds
			logframe.siteIds = logframe.entities;
			delete logframe.entities;

			// Rename parameter.elementId to parameter.variableId
			logframe.indicators.forEach(updateIndicator);
			logframe.purposes.forEach(purpose => {
				purpose.indicators.forEach(updateIndicator);
				purpose.outputs.forEach(output => {
					output.indicators.forEach(updateIndicator);
				});
			});
		});

		// Rename items inside users
		project.users.forEach(user => {
			if (user.dataSources) {
				user.dataSourceIds = user.dataSources;
				delete user.dataSources;
			}

			if (user.entities) {
				user.siteIds = user.entities;
				delete user.entities;
			}
		});
	});

	// Insert 20 by 20 to avoid killing the database
	while (documents.length)
		await database.callBulk({docs: documents.splice(0, 20)});
};

const migrateDesignDoc = async () => {
	// Update design document.
	const ddoc = await database.get('_design/monitool');









	for (let key in ddoc.views)
		ddoc.views[key].map = ddoc.views[key].map.replace(/[\n\t\s]+/g, ' ');

	await database.insert(ddoc);
};

/**
 * Big renaming migration
 */
export default async function() {
	// The order matters, do not change it.
	await migrateInputs();
	await migrateProjects();
	await migrateDesignDoc();
};

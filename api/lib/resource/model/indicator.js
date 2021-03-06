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

import validator from 'is-my-json-valid';
import DbModel from './db-model';
import IndicatorStore from '../store/indicator';
import Theme from './theme';
import schema from '../schema/indicator.json';

import Project from './project';

var validate = validator(schema),
	storeInstance = new IndicatorStore();

export default class Indicator extends DbModel {

	static get storeInstance() { return storeInstance; }

	/**
	 * Deserialize and validate a indicator that comes from either API or Database.
	 */
	constructor(data) {
		super(data, validate);
	}

	/**
	 * Validate that indicator does not make references to themes that don't exist
	 */
	async validateForeignKeys() {
		// If no themes are defined, early quit
		if (this.themes.length === 0)
			return;

		// Otherwise we just fetch all themes and check.
		const themes = await Theme.storeInstance.list();

		this.themes.forEach(themeId => {
			if (!themes.find(t => t._id === themeId))
				throw new Error('invalid_reference');
		});
	}

	/**
	 * Delete indicator and updates all projects that are using it.
	 */
	async destroy() {
		const projects = await Project.storeInstance.listByIndicator(this._id, false);

		// Delete cross cutting indicator from projects.
		projects.forEach(project => delete project.crossCutting[this._id]);

		// Mark ourself as deleted
		this._deleted = true;

		// Save everything in on request
		await this._db.callBulk({docs: [this, ...projects]});
	}
}


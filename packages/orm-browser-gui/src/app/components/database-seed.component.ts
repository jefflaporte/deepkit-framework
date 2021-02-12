import { ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { DatabaseInfo, FakerTypes, findFaker, SeedDatabase } from '@deepkit/orm-browser-api';
import { filterEntitiesToList, trackByIndex, trackBySchema } from '../utils';
import { ControllerClient } from '../client';
import { ClassSchema } from '@deepkit/type';
import { BrowserState } from '../browser-state';
import { DuiDialog } from '@deepkit/desktop-ui';
import { FakerTypeDialogComponent } from './dialog/faker-type-dialog.component';

@Component({
    selector: 'orm-browser-seed',
    template: `
        <div class="actions">
            <dui-button [disabled]="seeding" (click)="seed()">Seed</dui-button>
        </div>
        <div class="entities" *ngIf="database && fakerTypes">
            <div class="entity" *ngFor="let entity of filterEntitiesToList(database.getClassSchemas()); trackBy: trackBySchema">
                <ng-container
                    *ngIf="state.getSeedSettings(fakerTypes, database.name, entity.getName()) as settings">
                    <h3>
                        <dui-checkbox [(ngModel)]="settings.active">{{entity.getClassName()}}</dui-checkbox>
                    </h3>

                    <ng-container *ngIf="settings.active">
                        <div class="settings">
                            <dui-input lightFocus round type="number" [(ngModel)]="settings.amount" placeholder="amount"></dui-input>
                            <dui-checkbox style="margin-left: 5px;" [(ngModel)]="settings.truncate">Delete all before seeding</dui-checkbox>
                        </div>

                        <dui-button-group padding="none" style="margin: 5px 0;">
                            <dui-button textured (click)="resetTypes(entity)">Reset</dui-button>
                            <dui-button textured (click)="autoTypes(entity)">Auto</dui-button>
                        </dui-button-group>

                        <dui-table [autoHeight]="true" [preferenceKey]="'orm-browser/seed/' + entity.getName()" [sorting]="false" noFocusOutline [items]="settings.properties">
                            <dui-table-column name="name" [width]="200"></dui-table-column>
                            <dui-table-column name="type" [width]="100">
                                <ng-container *duiTableCell="let row">
                                    <ng-container *ngIf="entity.getProperty(row.name) as property">
                                        <span style="color: var(--text-grey)">{{property.toString()}}</span>
                                    </ng-container>
                                </ng-container>
                            </dui-table-column>

                            <dui-table-column name="value" [width]="320" class="cell-value">
                                <ng-container *duiTableCell="let row">
                                    <ng-container *ngIf="entity.getProperty(row.name) as property">
                                        <ng-container *ngIf="property.isAutoIncrement" style="color: var(--text-grey)">
                                            Auto-Increment
                                        </ng-container>

                                        <ng-container *ngIf="!property.isAutoIncrement">
                                            <dui-checkbox [(ngModel)]="row.fake" (ngModelChange)="typeChanged(entity)">Fake</dui-checkbox>

                                            <div class="property-seed-value select" *ngIf="row.fake && property.isReference">
                                                <dui-select textured small [(ngModel)]="row.reference">
                                                    <dui-option value="random">Random from database</dui-option>
                                                    <dui-option value="random-seed">Random from seed</dui-option>
                                                    <dui-option value="create">Create new</dui-option>
                                                </dui-select>
                                            </div>

                                            <div class="property-seed-value" *ngIf="row.fake && !property.isReference">
                                                <ng-container *ngIf="!row.faker">
                                                    <dui-button small (click)="chooseType(entity, property.name)">Choose</dui-button>
                                                </ng-container>

                                                <div class="choose-type" *ngIf="row.faker">
                                                    <div>
                                                        {{row.faker}}
                                                        <span style="color: var(--text-grey)">
                                                        {{fakerTypes[row.faker]?.type}}
                                                    </span>
                                                    </div>
                                                    <dui-button (click)="chooseType(entity, property.name)" small>Change</dui-button>
                                                </div>
                                            </div>

                                            <div class="property-seed-value" *ngIf="!row.fake">
                                                <orm-browser-property [(model)]="row.value" [property]="property"></orm-browser-property>
                                            </div>
                                        </ng-container>
                                    </ng-container>
                                </ng-container>
                            </dui-table-column>

                            <dui-table-column name="example" [width]="350">
                                <ng-container *duiTableCell="let row">
                                    <ng-container *ngIf="entity.getProperty(row.name) as property">
                                        <ng-container *ngIf="row.fake && !property.isAutoIncrement && !property.isReference">
                                            {{fakerTypes[row.faker]?.example}}
                                        </ng-container>
                                    </ng-container>
                                </ng-container>
                            </dui-table-column>
                        </dui-table>
                    </ng-container>
                </ng-container>
            </div>
        </div>
    `,
    styleUrls: ['./database-seed.component.scss']
})
export class DatabaseSeedComponent implements OnChanges {
    @Input() database!: DatabaseInfo;
    fakerTypes?: FakerTypes;
    fakerTypesArray?: ({ name: string, type: string })[];
    trackBySchema = trackBySchema;
    trackByIndex = trackByIndex;
    filterEntitiesToList = filterEntitiesToList;

    seeding: boolean = false;

    constructor(
        protected controllerClient: ControllerClient,
        protected cd: ChangeDetectorRef,
        protected duiDialog: DuiDialog,
        public state: BrowserState,
    ) {
    }

    async ngOnChanges() {
        await this.load();
    }

    protected async load() {
        try {
            this.fakerTypes = await this.controllerClient.browser.getFakerTypes();
            this.fakerTypesArray = [];
            for (const [name, info] of Object.entries(this.fakerTypes)) {
                this.fakerTypesArray.push({ name, type: info.type });
            }
        } finally {
        }
        this.cd.detectChanges();
    }

    chooseType(entity: ClassSchema, propertyName: string) {
        if (!this.fakerTypes) return;
        const settings = this.state.getSeedSettings(this.fakerTypes, this.database.name, entity.getName());
        const property = settings.properties.find(v => v.name === propertyName);
        if (!property) return;

        const { component } = this.duiDialog.open(FakerTypeDialogComponent, {
            fakerTypes: this.fakerTypes,
            selected: property.faker
        });

        component.chosen.subscribe((value) => {
            property.faker = value;
            this.cd.detectChanges();
        });
    }

    typeChanged(entity: ClassSchema) {
        this.state.storeSeedSettings(this.database.name, entity.getName());
    }

    async seed() {
        if (!await this.duiDialog.confirm('Seed now?', 'You are about to seed your database. All content may be lost.')) return;

        this.seeding = true;
        this.cd.detectChanges();

        try {
            const dbSeeding: SeedDatabase = { entities: {} };
            for (const entity of filterEntitiesToList(this.database.getClassSchemas())) {
                const key = this.state.getStoreKey(this.database.name, entity.getName());
                const settings = this.state.seedSettings[key];
                if (!settings || !settings.active) continue;

                dbSeeding.entities[entity.getName()] = settings;
            }
            await this.controllerClient.browser.seed(this.database.name, dbSeeding);
        } catch (error) {
            await this.duiDialog.alert('Error seeding', error);
        }

        this.state.onDataChange.emit();
        this.seeding = false;
        this.cd.detectChanges();
    }

    autoTypes(entity: ClassSchema) {
        if (!this.fakerTypes) return;
        const settings = this.state.getSeedSettings(this.fakerTypes, this.database.name, entity.getName());
        for (const property of settings.properties) {
            property.faker = findFaker(this.fakerTypes, entity.getProperty(property.name));
            property.fake = !!property.faker;
        }
        this.typeChanged(entity);
    }

    resetTypes(entity: ClassSchema) {
        if (!this.fakerTypes) return;
        const settings = this.state.getSeedSettings(this.fakerTypes, this.database.name, entity.getName());
        for (const property of settings.properties) {
            property.faker = '';
            property.fake = false;
        }
        this.typeChanged(entity);
    }

}

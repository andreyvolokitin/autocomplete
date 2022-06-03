import {
  AutocompleteState,
  AutocompleteSource,
  AutocompletePlugin,
  getAlgoliaResults,
} from '@algolia/autocomplete-js';
import { getAttributeValueByPath } from '@algolia/autocomplete-shared';
import { SearchOptions } from '@algolia/client-search';
import { SearchClient } from 'algoliasearch/lite';

import { getTemplates } from './getTemplates';
import {
  AutocompleteQuerySuggestionsHit,
  QuerySuggestionsHit,
  QuerySuggestionsFacetValue,
} from './types';

export type CreateQuerySuggestionsPluginParams<
  TItem extends QuerySuggestionsHit
> = {
  /**
   * The initialized Algolia search client.
   *
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-plugin-query-suggestions/createQuerySuggestionsPlugin/#param-searchclient
   */
  searchClient: SearchClient;
  /**
   * The index name.
   *
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-plugin-query-suggestions/createQuerySuggestionsPlugin/#param-indexname
   */
  indexName: string;
  /**
   * A function returning [Algolia search parameters](https://www.algolia.com/doc/api-reference/search-api-parameters/).
   *
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-plugin-query-suggestions/createQuerySuggestionsPlugin/#param-getsearchparams
   */
  getSearchParams?(params: { state: AutocompleteState<TItem> }): SearchOptions;
  /**
   * A function to transform the provided source.
   *
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-plugin-query-suggestions/createQuerySuggestionsPlugin/#param-transformsource
   */
  transformSource?(params: {
    source: AutocompleteSource<TItem>;
    state: AutocompleteState<TItem>;
    onTapAhead(item: TItem): void;
  }): AutocompleteSource<TItem>;
  /**
   * The attribute attribute path, or array of paths to display categories for.
   *
   * @example ["instant_search", "facets", "exact_matches", "categories"]
   * @example ["instant_search", "facets", "exact_matches", "hierarchicalCategories.lvl0"]
   * @example [
   *     ["index_1", "facets", "exact_matches", "data_origin"],
   *     ["index_2", "facets", "exact_matches", "data_origin"],
   *   ]
   * @example [
   *     ["index_1", "facets", "exact_matches", "attr_1"],
   *     ["index_2", "facets", "exact_matches", "attr_2"],
   *   ]
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-plugin-query-suggestions/createQuerySuggestionsPlugin/#param-categoryattribute
   */
  categoryAttribute?: string | string[] | string[][];
  /**
   * How many items to display categories for.
   *
   * @default 1
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-plugin-query-suggestions/createQuerySuggestionsPlugin/#param-itemswithcategories
   */
  itemsWithCategories?: number;
  /**
   * The number of categories to display per item.
   *
   * @default 1
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-plugin-query-suggestions/createQuerySuggestionsPlugin/#param-categoriesperitem
   */
  categoriesPerItem?: number;
};

export function createQuerySuggestionsPlugin<
  TItem extends AutocompleteQuerySuggestionsHit
>(
  options: CreateQuerySuggestionsPluginParams<TItem>
): AutocompletePlugin<TItem, undefined> {
  const {
    searchClient,
    indexName,
    getSearchParams,
    transformSource,
    categoryAttribute,
    itemsWithCategories,
    categoriesPerItem,
  } = getOptions(options);

  return {
    name: 'aa.querySuggestionsPlugin',
    getSources({ query, setQuery, refresh, state }) {
      function onTapAhead(item: TItem) {
        setQuery(`${item.query} `);
        refresh();
      }

      return [
        transformSource({
          source: {
            sourceId: 'querySuggestionsPlugin',
            getItemInputValue({ item }) {
              return item.query;
            },
            getItems() {
              return getAlgoliaResults({
                searchClient,
                queries: [
                  {
                    indexName,
                    query,
                    params: getSearchParams({
                      state: state as AutocompleteState<TItem>,
                    }),
                  },
                ],
                transformResponse({ hits }) {
                  const querySuggestionsHits: Array<
                    AutocompleteQuerySuggestionsHit<typeof indexName>
                  > = hits[0];

                  if (!query || !categoryAttribute) {
                    return querySuggestionsHits as any;
                  }

                  return querySuggestionsHits.reduce<
                    Array<AutocompleteQuerySuggestionsHit<typeof indexName>>
                  >((acc, current, i) => {
                    const items: Array<
                      AutocompleteQuerySuggestionsHit<typeof indexName>
                    > = [current];

                    if (i <= itemsWithCategories - 1) {
                      let paths = (Array.isArray(categoryAttribute[0])
                        ? categoryAttribute
                        : [categoryAttribute]) as string[][];

                      if (typeof categoryAttribute === 'string') {
                        paths = [[categoryAttribute]];
                      }

                      const categoriesValues = paths.reduce<
                        QuerySuggestionsFacetValue[]
                      >((totalCategories, path) => {
                        const attrVal = getAttributeValueByPath(current, path);

                        return attrVal
                          ? totalCategories.concat(attrVal)
                          : totalCategories;
                      }, []);

                      if (paths.length > 1) {
                        categoriesValues.sort((a, b) => b.count - a.count);
                      }

                      const categories = categoriesValues
                        .map((x) => x.value)
                        .slice(0, categoriesPerItem);

                      for (const category of categories) {
                        items.push({
                          __autocomplete_qsCategory: category,
                          ...current,
                        } as any);
                      }
                    }

                    acc.push(...items);

                    return acc;
                  }, []);
                },
              });
            },
            templates: getTemplates({ onTapAhead }),
          },
          onTapAhead,
          state: state as AutocompleteState<TItem>,
        }),
      ];
    },
    __autocomplete_pluginOptions: options,
  };
}

function getOptions<TItem extends AutocompleteQuerySuggestionsHit>(
  options: CreateQuerySuggestionsPluginParams<TItem>
) {
  return {
    getSearchParams: () => ({}),
    transformSource: ({ source }) => source,
    itemsWithCategories: 1,
    categoriesPerItem: 1,
    ...options,
  };
}

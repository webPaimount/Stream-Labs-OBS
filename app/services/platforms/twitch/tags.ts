import { Observable, EMPTY } from 'rxjs';
import { concatMap, expand, filter, toArray } from 'rxjs/operators';
import sortBy from 'lodash/sortBy';
import { TTwitchPagination } from './pagination';
import { TTwitchStreamResponse } from './stream';
import { ITwitchRequestHeaders, TwitchService } from '../twitch';
import { platformAuthorizedRequest } from '../utils';
import { fromPromise } from 'rxjs/internal-compatibility';
import { getPlatformService } from '../index';

/**
 * A tag on Twitch that could be assigned to a Stream.
 */
export type TTwitchTag = {
  tag_id: string;
  /**
   * `true` if the tag is autogenerated. The user is not able to add or remove these.
   */
  is_auto: boolean;
  /** Translations for tag name **/
  localization_names: {
    /**
     * Keys are locale names, in underscore (e.g. `en-us`). Values are the translations.
     */
    [locale: string]: string;
  };
  /** Translations for tag description **/
  localization_descriptions: {
    [locale: string]: string;
  };
};

/**
 * TTwitchTag with a label and description in the user's locale or `en-US` as fallback
 */
export type TTwitchTagWithLabel = TTwitchTag & { name: string; description: string };

/**
 * Response coming from Twitch from the all Tags endpoint.
 */
type TTwitchTagsResponse = {
  /** Response items **/
  data: TTwitchTag[];
  /** Pagination info, including cursor **/
  pagination: TTwitchPagination;
};

/**
 * Intermediate representation of a Twitch tag response so
 * we can request subsequent pages of tags.
 */
interface IPaginatedResponse {
  items: TTwitchTag[];
  cursor: string;
}

/**
 * Map a Twitch tags response to an object containing items and cursor for pagination
 * @param cursor To be used for pagination, the empty string specifies the initial page
 * @see {ITwitchRequestHeaders}
 */
const requestTags = (cursor: string): Observable<IPaginatedResponse> =>
  fromPromise(
    (getPlatformService('twitch') as TwitchService)
      .requestTwitch<{
        data: TTwitchTag[];
        pagination: { cursor: string };
      }>(`https://api.twitch.tv/helix/tags/streams?first=100&after=${cursor}`)
      .then(response => ({
        cursor: response.pagination.cursor,
        items: response.data,
      })),
  );

/**
 * Fetch all tags for a particular stream
 *
 * @param broadcasterId The stream ID on Twitch
 * @param headers Request headers
 * @see {ITwitchRequestHeaders}
 */
export const getStreamTags = (broadcasterId: string): Promise<string[]> =>
  (getPlatformService('twitch') as TwitchService)
    .requestTwitch<TTwitchStreamResponse>(
      `https://api.twitch.tv/helix/streams?broadcaster_id=${broadcasterId}`,
    )
    .then(res => res.data[0].tags);

/**
 * Fetch a string translation from the Twitch response, or fallback to `en-us`
 *
 * @param key The key to fetch a translation for
 * @returns Function with the given key preset, so we can add specialized functions below
 * @see {TTwitchTag, getLabelFor, getDescriptionFor}
 */
const getTwitchLocalizedString = (key: string) => (tag: TTwitchTag, locale: string): string => {
  return tag[key][locale.toLowerCase()] || tag[key]['en-us'];
};

/**
 * Get the label (aka name) for a Twitch tag
 */
const getLabelFor = getTwitchLocalizedString('localization_names');

/**
 * Get the tag description for a given tag
 */
const getDescriptionFor = getTwitchLocalizedString('localization_descriptions');

/**
 * Assign name and description to a list of Twitch tags,
 *
 * Get their localized strings from response.
 *
 * @param locale User's locale
 * @param tags A list of tags to assign labels and descriptions to
 */
const assignLabels = (locale: string, tags: TTwitchTag[]): TTwitchTagWithLabel[] =>
  tags.map(tag => ({
    ...tag,
    name: getLabelFor(tag, locale),
    description: getDescriptionFor(tag, locale),
  }));

/**
 * Prepare options for a multiselect component
 *
 * @param locale The user's locale
 * @param tags A list of Twitch Tags
 * @returns A list of Twitch tags with assigned labels and descriptions
 */
export const prepareOptions = (
  locale: string,
  tags: TTwitchTag[] | undefined,
): TTwitchTagWithLabel[] => {
  if (tags && tags.length) {
    const tagsWithLabels = assignLabels(locale, tags);
    return sortBy(tagsWithLabels, 'name');
  }

  return [];
};

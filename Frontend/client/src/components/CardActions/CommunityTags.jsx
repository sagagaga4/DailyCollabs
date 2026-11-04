import { Link } from 'react-router-dom';
import { recommendCommunities } from './recommendations';
import { useCardActions } from './useCardActions';

export default function CommunityTags({ content, limit = 2 }) {
  const { communities, joining, joinCommunity, communitiesLoading } = useCardActions();
  const recommended = recommendCommunities(content, communities, limit);
  if (!recommended.length) return <div className="dc-community-tags"><Link to="/Communities">{communitiesLoading ? 'Finding communities…' : '#ExploreCommunities'} ↗</Link></div>;
  return <div className="dc-community-tags" aria-label="Recommended communities">
    <span className="dc-tags-label">{recommended.some((item) => item.recommendationScore > 0) ? 'Find your people' : 'Explore'}</span>
    {recommended.map((community) => <span className="dc-community-tag" key={community._id}>
      <Link to={`/Communities/${community._id}`} title={community.name}>#{community.name.replace(/\s+/g, '')}</Link>
      {community.isMember ? <span className="dc-tag-joined" title="You joined this community" aria-label="Joined">✓</span> : community.requiresRulesAcceptance ? <Link className="dc-tag-rules" to={`/Communities/${community._id}?channel=welcome`} title="Read the rules before joining" aria-label={`Read rules and join ${community.name}`}>↗</Link> : <button type="button" disabled={joining === community._id} onClick={(event) => { event.stopPropagation(); joinCommunity(community._id); }} aria-label={`Join ${community.name}`}>{joining === community._id ? '…' : '+'}</button>}
    </span>)}
  </div>;
}

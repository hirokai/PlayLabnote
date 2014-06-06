/** @jsx React.DOM */


var AddExp = React.createClass({
   render: function() {
       return (
          <button className='btn btn-default' onClick={this.handleClick}>Add Exp!</button>
       );
   },
    handleClick: function(){
        console.log(this);
        $.post('/exps',{name: "New exp"},function(res){
         //   console.log(res,expList);
            $.get('/exps.json', function(result) {
              expList.setState({
                experiments: result,
                  loaded: true
              });
            });
        });
    }
});

var ExpList = React.createClass({
    render: function(){
        var rows = [];
        this.props.experiments.forEach(function(e){
             rows.push(<li key={e.id}>{e.name}</li>)
        });
        var count = rows.length;
        return (
            <div>
                <span>{count} records.</span>
                <ul>{rows}</ul>
            </div>

            );
    }
});

var ExpListContainer = React.createClass({
    getInitialState: function(){
      return {
         experiments: [],
          loaded: false
      };
    },
    componentDidMount: function() {
      $.get('/exps.json', function(result) {
        this.setState({
          experiments: result,
            loaded: true
        });
      }.bind(this));
    },
    render: function(){
        if(this.state.loaded){
            return <ExpList experiments={this.state.experiments} />;
        }else{
            return <p>Loading...</p>
        }
    }
});

var testData = [{id: 1, name: "Hey"},{id: 2, name: "Yo"}];

expList = React.renderComponent(
    <ExpListContainer />,
    document.getElementById("expListDiv")
);
